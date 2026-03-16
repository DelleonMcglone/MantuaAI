/**
 * Portfolio API routes — pool creation, transactions, agent wallets
 */
import { Router, Request, Response } from 'express';
import { pool as dbPool } from '../db/index';

const router = Router();
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
let portfolioSchemaReadyPromise: Promise<void> | null = null;

function normalizeWalletAddress(address?: string): string {
  return (address || '').trim().toLowerCase();
}

async function ensurePortfolioSchema(): Promise<void> {
  if (!portfolioSchemaReadyPromise) {
    portfolioSchemaReadyPromise = (async () => {
      await dbPool.query(`
        ALTER TABLE pools
        ADD COLUMN IF NOT EXISTS hook_address VARCHAR(42) DEFAULT '${ZERO_ADDRESS}';
      `);
      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS positions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          wallet_address VARCHAR(42) NOT NULL,
          pool_id UUID REFERENCES pools(id),
          position_token_id BIGINT,
          token0 VARCHAR(10) NOT NULL,
          token1 VARCHAR(10) NOT NULL,
          liquidity DECIMAL(36,18) NOT NULL DEFAULT 0,
          amount0 DECIMAL(36,18) DEFAULT 0,
          amount1 DECIMAL(36,18) DEFAULT 0,
          fee_tier INTEGER,
          pool_address VARCHAR(42) DEFAULT '${ZERO_ADDRESS}',
          tick_lower INTEGER DEFAULT 0,
          tick_upper INTEGER DEFAULT 0,
          status TEXT DEFAULT 'active',
          chain_id INTEGER NOT NULL DEFAULT 84532,
          hook_address VARCHAR(42) DEFAULT '${ZERO_ADDRESS}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await dbPool.query(`CREATE INDEX IF NOT EXISTS idx_positions_wallet ON positions(wallet_address);`);
      await dbPool.query(`CREATE INDEX IF NOT EXISTS idx_positions_pool_id ON positions(pool_id);`);
      await dbPool.query(`CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);`);
      await dbPool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.views
            WHERE table_schema = 'public' AND table_name = 'lp_positions'
          ) THEN
            EXECUTE 'CREATE VIEW lp_positions AS SELECT * FROM positions';
          END IF;
        END $$;
      `);
    })().catch((err) => {
      portfolioSchemaReadyPromise = null;
      throw err;
    });
  }

  await portfolioSchemaReadyPromise;
}

async function insertPositionWithFallback(params: {
  ownerAddress: string;
  poolId: string | null;
  positionTokenId: string | number | null;
  token0: string;
  token1: string;
  liquidity: string | number;
  amount0: string | number;
  amount1: string | number;
  feeTier: number;
  networkChainId: number;
  resolvedHookAddress: string;
}) {
  const {
    ownerAddress,
    poolId,
    positionTokenId,
    token0,
    token1,
    liquidity,
    amount0,
    amount1,
    feeTier,
    networkChainId,
    resolvedHookAddress,
  } = params;

  try {
    return (
      await dbPool.query(
        `INSERT INTO positions
           (wallet_address, pool_id, position_token_id, token0, token1, liquidity, amount0, amount1,
            fee_tier, pool_address, tick_lower, tick_upper, status, chain_id, hook_address)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,0,'active',$11,$12)
         RETURNING *`,
        [
          ownerAddress,
          poolId,
          positionTokenId,
          token0,
          token1,
          liquidity,
          amount0,
          amount1,
          feeTier,
          ZERO_ADDRESS,
          networkChainId,
          resolvedHookAddress,
        ]
      )
    ).rows[0];
  } catch (insertErr: unknown) {
    const insertMsg = insertErr instanceof Error ? insertErr.message : String(insertErr);
    if (!insertMsg.includes('hook_address')) throw insertErr;

    return (
      await dbPool.query(
        `INSERT INTO positions
           (wallet_address, pool_id, position_token_id, token0, token1, liquidity, amount0, amount1,
            fee_tier, pool_address, tick_lower, tick_upper, status, chain_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,0,'active',$11)
         RETURNING *`,
        [
          ownerAddress,
          poolId,
          positionTokenId,
          token0,
          token1,
          liquidity,
          amount0,
          amount1,
          feeTier,
          ZERO_ADDRESS,
          networkChainId,
        ]
      )
    ).rows[0];
  }
}

// ─── Pools ────────────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    await ensurePortfolioSchema();
    const chainId = parseInt(req.query.chainId as string) || 84532;
    const { rows } = await dbPool.query(
      `SELECT * FROM pools WHERE chain_id = $1 ORDER BY created_at DESC`,
      [chainId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pools' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    await ensurePortfolioSchema();
    const { token0, token1, feeTier, creatorAddress, txHash, chainId, hookAddress } = req.body;
    if (!token0 || !token1 || feeTier === undefined || feeTier === null || !creatorAddress || !txHash) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const networkChainId = parseInt(chainId) || 84532;
    const resolvedHookAddress = hookAddress || '0x0000000000000000000000000000000000000000';

    const existing = await dbPool.query(
      `SELECT * FROM pools WHERE tx_hash = $1 LIMIT 1`,
      [txHash]
    );
    if (existing.rows[0]) {
      return res.status(200).json(existing.rows[0]);
    }

    try {
      const { rows } = await dbPool.query(
        `INSERT INTO pools (token0, token1, fee_tier, creator_address, tx_hash, chain_id, hook_address)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [token0, token1, feeTier, normalizeWalletAddress(creatorAddress), txHash, networkChainId, resolvedHookAddress]
      );
      return res.status(201).json(rows[0]);
    } catch (insertErr: unknown) {
      const insertMsg = insertErr instanceof Error ? insertErr.message : String(insertErr);

      // Backward compatibility for databases that predate the hook_address migration.
      if (insertMsg.includes('hook_address')) {
        const legacy = await dbPool.query(
          `INSERT INTO pools (token0, token1, fee_tier, creator_address, tx_hash, chain_id)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [token0, token1, feeTier, normalizeWalletAddress(creatorAddress), txHash, networkChainId]
        );
        return res.status(201).json(legacy.rows[0]);
      }

      throw insertErr;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to save pool', detail: msg });
  }
});

router.post('/backfill-pool', async (req: Request, res: Response) => {
  try {
    await ensurePortfolioSchema();
    const {
      walletAddress,
      creatorAddress,
      txHash,
      token0,
      token1,
      feeTier,
      chainId,
      hookAddress,
      amount0,
      amount1,
      liquidity,
      type,
    } = req.body;

    const ownerAddress = normalizeWalletAddress(walletAddress || creatorAddress);
    if (!ownerAddress || !txHash || !token0 || !token1 || feeTier === undefined || feeTier === null) {
      console.error(JSON.stringify({ stage: 'backfill-pool:missing-fields', ownerAddress: !!ownerAddress, txHash: !!txHash, token0: !!token0, token1: !!token1, feeTier }));
      return res.status(400).json({
        error: 'walletAddress (or creatorAddress), txHash, token0, token1, and feeTier are required',
      });
    }

    const networkChainId = parseInt(chainId) || 84532;
    const resolvedHookAddress = hookAddress || ZERO_ADDRESS;

    let poolRow = (
      await dbPool.query(`SELECT * FROM pools WHERE tx_hash = $1 LIMIT 1`, [txHash])
    ).rows[0];

    if (!poolRow) {
      try {
        console.error(JSON.stringify({
          stage: 'backfill-pool:before-pool-insert',
          ownerAddress,
          txHash,
          token0,
          token1,
          feeTier,
          chainId: networkChainId,
          hookAddress: resolvedHookAddress,
        }));
        poolRow = (
          await dbPool.query(
            `INSERT INTO pools (token0, token1, fee_tier, creator_address, tx_hash, chain_id, hook_address)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [token0, token1, feeTier, ownerAddress, txHash, networkChainId, resolvedHookAddress]
          )
        ).rows[0];
        console.error(JSON.stringify({
          stage: 'backfill-pool:after-pool-insert',
          poolId: poolRow.id,
          txHash: poolRow.tx_hash,
        }));
      } catch (insertErr: unknown) {
        const insertMsg = insertErr instanceof Error ? insertErr.message : String(insertErr);
        console.error(JSON.stringify({
          stage: 'backfill-pool:pool-insert-failed',
          error: insertErr instanceof Error ? { message: insertErr.message, stack: insertErr.stack, name: insertErr.name } : insertErr,
        }));
        if (insertMsg.includes('hook_address')) {
          poolRow = (
            await dbPool.query(
              `INSERT INTO pools (token0, token1, fee_tier, creator_address, tx_hash, chain_id)
               VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
              [token0, token1, feeTier, ownerAddress, txHash, networkChainId]
            )
          ).rows[0];
          console.error(JSON.stringify({
            stage: 'backfill-pool:after-pool-insert-legacy',
            poolId: poolRow.id,
            txHash: poolRow.tx_hash,
          }));
        } else {
          throw insertErr;
        }
      }
    }

    let positionRow = (
      await dbPool.query(
        `SELECT * FROM positions
         WHERE wallet_address = $1
           AND pool_id = $2
           AND token0 = $3
           AND token1 = $4
           AND fee_tier = $5
           AND chain_id = $6
           AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1`,
        [ownerAddress, poolRow.id, token0, token1, feeTier, networkChainId]
      )
    ).rows[0];

    if (!positionRow) {
      positionRow = await insertPositionWithFallback({
        ownerAddress,
        poolId: poolRow.id,
        positionTokenId: null,
        token0,
        token1,
        liquidity: liquidity || '1',
        amount0: amount0 || '0',
        amount1: amount1 || '0',
        feeTier,
        networkChainId,
        resolvedHookAddress,
      });
    }

    const txType = type || 'add_liquidity';
    let transactionRow = (
      await dbPool.query(
        `SELECT * FROM portfolio_transactions WHERE tx_hash = $1 LIMIT 1`,
        [txHash]
      )
    ).rows[0];

    if (!transactionRow) {
      transactionRow = (
        await dbPool.query(
          `INSERT INTO portfolio_transactions
             (wallet_address, type, tx_hash, token_in, token_out, amount_in, amount_out, pool_id, chain_id, base_scan_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (tx_hash) DO NOTHING
           RETURNING *`,
          [
            ownerAddress,
            txType,
            txHash,
            token0,
            token1,
            amount0 || '0',
            amount1 || '0',
            poolRow.id,
            networkChainId,
            `https://sepolia.basescan.org/tx/${txHash}`,
          ]
        )
      ).rows[0];

      if (!transactionRow) {
        transactionRow = (
          await dbPool.query(
            `SELECT * FROM portfolio_transactions WHERE tx_hash = $1 LIMIT 1`,
            [txHash]
          )
        ).rows[0];
      }
    }

    res.status(200).json({
      success: true,
      pool: poolRow,
      position: positionRow,
      transaction: transactionRow,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(JSON.stringify({
      stage: 'backfill-pool:handler-failed',
      error: err instanceof Error ? { message: err.message, stack: err.stack, name: err.name } : err,
      txHash: req.body?.txHash,
      token0: req.body?.token0,
      token1: req.body?.token1,
    }));
    res.status(500).json({ error: 'Failed to backfill pool', detail: msg });
  }
});

// ─── Stale Pool Cleanup ───────────────────────────────────────────────────────

router.delete('/stale-pools', async (req: Request, res: Response) => {
  try {
    const { chainId, feeTier } = req.query;
    // Delete pools matching optional filters. If no filters, deletes nothing (safety guard).
    if (!chainId && !feeTier) {
      return res.status(400).json({ error: 'Provide at least chainId or feeTier to scope deletion' });
    }
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (chainId) { params.push(parseInt(chainId as string)); conditions.push(`chain_id = $${params.length}`); }
    if (feeTier) { params.push(parseInt(feeTier as string)); conditions.push(`fee_tier = $${params.length}`); }
    const { rowCount } = await dbPool.query(
      `DELETE FROM pools WHERE ${conditions.join(' AND ')} RETURNING id`,
      params
    );
    res.json({ deleted: rowCount ?? 0 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to delete stale pools', detail: msg });
  }
});

// ─── User Portfolio Transactions ──────────────────────────────────────────────

router.get('/transactions', async (req: Request, res: Response) => {
  try {
    await ensurePortfolioSchema();
    const { walletAddress } = req.query;
    if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });
    const { rows } = await dbPool.query(
      `SELECT * FROM portfolio_transactions
       WHERE wallet_address = $1 ORDER BY timestamp DESC LIMIT 50`,
      [normalizeWalletAddress(walletAddress as string)]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.post('/transactions', async (req: Request, res: Response) => {
  try {
    await ensurePortfolioSchema();
    const { walletAddress, type, txHash, tokenIn, tokenOut, amountIn, amountOut, poolId, chainId } = req.body;
    if (!walletAddress || !type || !txHash) {
      return res.status(400).json({ error: 'walletAddress, type, txHash required' });
    }
    const networkChainId = parseInt(chainId) || 84532;
    const baseScanUrl = `https://sepolia.basescan.org/tx/${txHash}`;
    const { rows } = await dbPool.query(
      `INSERT INTO portfolio_transactions
         (wallet_address, type, tx_hash, token_in, token_out, amount_in, amount_out, pool_id, chain_id, base_scan_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (tx_hash) DO NOTHING RETURNING *`,
      [normalizeWalletAddress(walletAddress), type, txHash, tokenIn, tokenOut, amountIn, amountOut, poolId || null, networkChainId, baseScanUrl]
    );
    res.status(201).json(rows[0] ?? { skipped: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to save transaction', detail: msg });
  }
});

// ─── Agent Wallets ────────────────────────────────────────────────────────────

router.get('/agent-wallets', async (req: Request, res: Response) => {
  try {
    await ensurePortfolioSchema();
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const { rows } = await dbPool.query(
      `SELECT * FROM agent_wallets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [normalizeWalletAddress(userId as string)]
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agent wallet' });
  }
});

router.post('/agent-wallets', async (req: Request, res: Response) => {
  try {
    await ensurePortfolioSchema();
    const { userId, walletId, address } = req.body;
    if (!userId || !walletId || !address) {
      return res.status(400).json({ error: 'userId, walletId, address required' });
    }
    const { rows } = await dbPool.query(
      `INSERT INTO agent_wallets (user_id, wallet_id, address)
       VALUES ($1,$2,$3) ON CONFLICT (wallet_id) DO NOTHING RETURNING *`,
      [normalizeWalletAddress(userId), walletId, normalizeWalletAddress(address)]
    );
    res.status(201).json(rows[0] ?? { skipped: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to save agent wallet', detail: msg });
  }
});

// ─── Agent Portfolio Transactions ─────────────────────────────────────────────

router.get('/agent-transactions', async (req: Request, res: Response) => {
  try {
    await ensurePortfolioSchema();
    const { agentWalletId } = req.query;
    if (!agentWalletId) return res.status(400).json({ error: 'agentWalletId required' });
    const { rows } = await dbPool.query(
      `SELECT * FROM agent_portfolio_transactions
       WHERE agent_wallet_id = $1 ORDER BY timestamp DESC LIMIT 50`,
      [agentWalletId as string]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agent transactions' });
  }
});

router.post('/agent-transactions', async (req: Request, res: Response) => {
  try {
    await ensurePortfolioSchema();
    const { agentWalletId, type, txHash, tokenIn, tokenOut, amountIn, amountOut, chainId } = req.body;
    if (!agentWalletId || !type || !txHash) {
      return res.status(400).json({ error: 'agentWalletId, type, txHash required' });
    }
    const networkChainId = parseInt(chainId) || 84532;
    const baseScanUrl = `https://sepolia.basescan.org/tx/${txHash}`;
    const { rows } = await dbPool.query(
      `INSERT INTO agent_portfolio_transactions
         (agent_wallet_id, type, tx_hash, token_in, token_out, amount_in, amount_out, base_scan_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (tx_hash) DO NOTHING RETURNING *`,
      [agentWalletId, type, txHash, tokenIn, tokenOut, amountIn, amountOut, baseScanUrl]
    );
    res.status(201).json(rows[0] ?? { skipped: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to save agent transaction', detail: msg });
  }
});

// ─── LP Positions ─────────────────────────────────────────────────────────────

router.get('/positions', async (req: Request, res: Response) => {
  try {
    await ensurePortfolioSchema();
    const { walletAddress, poolId, chainId } = req.query;
    if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });
    const params: unknown[] = [normalizeWalletAddress(walletAddress as string)];
    let whereClause = `WHERE wallet_address = $1 AND status = 'active'`;
    if (chainId) {
      params.push(parseInt(chainId as string));
      whereClause += ` AND chain_id = $${params.length}`;
    }
    if (poolId) {
      params.push(poolId as string);
      whereClause += ` AND pool_id = $${params.length}`;
    }
    const { rows } = await dbPool.query(
      `SELECT * FROM positions ${whereClause} ORDER BY created_at DESC LIMIT 20`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

router.post('/positions', async (req: Request, res: Response) => {
  try {
    await ensurePortfolioSchema();
    const { walletAddress, poolId, positionTokenId, token0, token1, liquidity, amount0, amount1, feeTier, chainId, hookAddress } = req.body;
    if (!walletAddress || !token0 || !token1 || !liquidity) {
      return res.status(400).json({ error: 'walletAddress, token0, token1, liquidity required' });
    }
    const networkChainId = parseInt(chainId) || 84532;
    const resolvedHookAddress = hookAddress || '0x0000000000000000000000000000000000000000';

    if (poolId) {
      const existing = await dbPool.query(
        `SELECT * FROM positions
         WHERE wallet_address = $1
           AND pool_id = $2
           AND token0 = $3
           AND token1 = $4
           AND fee_tier = $5
           AND chain_id = $6
           AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1`,
        [walletAddress.toLowerCase(), poolId, token0, token1, feeTier || 3000, networkChainId]
      );
      if (existing.rows[0]) {
        return res.status(200).json(existing.rows[0]);
      }
    }

    const rows = [await insertPositionWithFallback({
      ownerAddress: normalizeWalletAddress(walletAddress),
      poolId: poolId || null,
      positionTokenId: positionTokenId || null,
      token0,
      token1,
      liquidity,
      amount0: amount0 || 0,
      amount1: amount1 || 0,
      feeTier: feeTier || 3000,
      networkChainId,
      resolvedHookAddress,
    })];
    res.status(201).json(rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to save position', detail: msg });
  }
});

router.patch('/positions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, liquidity } = req.body;
    if (status) {
      await dbPool.query(
        `UPDATE positions SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, id]
      );
    }
    if (liquidity !== undefined) {
      await dbPool.query(
        `UPDATE positions SET liquidity = $1, updated_at = NOW() WHERE id = $2`,
        [liquidity, id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update position' });
  }
});

export default router;

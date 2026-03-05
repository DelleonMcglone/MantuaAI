/**
 * Portfolio API routes — pool creation, transactions, agent wallets
 */
import { Router, Request, Response } from 'express';
import { pool as dbPool } from '../db/index';

const router = Router();

// ─── Pools ────────────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
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
    const { token0, token1, feeTier, creatorAddress, txHash, chainId, hookAddress } = req.body;
    if (!token0 || !token1 || !feeTier || !creatorAddress || !txHash) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const networkChainId = parseInt(chainId) || 84532;
    const resolvedHookAddress = hookAddress || '0x0000000000000000000000000000000000000000';
    const { rows } = await dbPool.query(
      `INSERT INTO pools (token0, token1, fee_tier, creator_address, tx_hash, chain_id, hook_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [token0, token1, feeTier, creatorAddress.toLowerCase(), txHash, networkChainId, resolvedHookAddress]
    );
    res.status(201).json(rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to save pool', detail: msg });
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
    const { walletAddress } = req.query;
    if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });
    const { rows } = await dbPool.query(
      `SELECT * FROM portfolio_transactions
       WHERE wallet_address = $1 ORDER BY timestamp DESC LIMIT 50`,
      [(walletAddress as string).toLowerCase()]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.post('/transactions', async (req: Request, res: Response) => {
  try {
    const { walletAddress, type, txHash, tokenIn, tokenOut, amountIn, amountOut, poolId, chainId } = req.body;
    if (!walletAddress || !type || !txHash) {
      return res.status(400).json({ error: 'walletAddress, type, txHash required' });
    }
    const networkChainId = parseInt(chainId) || 84532;
    const baseScanUrl = networkChainId === 1301
      ? `https://sepolia.uniscan.xyz/tx/${txHash}`
      : `https://sepolia.basescan.org/tx/${txHash}`;
    const { rows } = await dbPool.query(
      `INSERT INTO portfolio_transactions
         (wallet_address, type, tx_hash, token_in, token_out, amount_in, amount_out, pool_id, base_scan_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (tx_hash) DO NOTHING RETURNING *`,
      [walletAddress.toLowerCase(), type, txHash, tokenIn, tokenOut, amountIn, amountOut, poolId || null, baseScanUrl]
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
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const { rows } = await dbPool.query(
      `SELECT * FROM agent_wallets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [(userId as string).toLowerCase()]
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agent wallet' });
  }
});

router.post('/agent-wallets', async (req: Request, res: Response) => {
  try {
    const { userId, walletId, address } = req.body;
    if (!userId || !walletId || !address) {
      return res.status(400).json({ error: 'userId, walletId, address required' });
    }
    const { rows } = await dbPool.query(
      `INSERT INTO agent_wallets (user_id, wallet_id, address)
       VALUES ($1,$2,$3) ON CONFLICT (wallet_id) DO NOTHING RETURNING *`,
      [userId.toLowerCase(), walletId, address.toLowerCase()]
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
    const { agentWalletId, type, txHash, tokenIn, tokenOut, amountIn, amountOut, chainId } = req.body;
    if (!agentWalletId || !type || !txHash) {
      return res.status(400).json({ error: 'agentWalletId, type, txHash required' });
    }
    const networkChainId = parseInt(chainId) || 84532;
    const baseScanUrl = networkChainId === 1301
      ? `https://sepolia.uniscan.xyz/tx/${txHash}`
      : `https://sepolia.basescan.org/tx/${txHash}`;
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
    const { walletAddress, poolId, chainId } = req.query;
    if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });
    const params: unknown[] = [(walletAddress as string).toLowerCase()];
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
    const { walletAddress, poolId, positionTokenId, token0, token1, liquidity, amount0, amount1, feeTier, chainId } = req.body;
    if (!walletAddress || !token0 || !token1 || !liquidity) {
      return res.status(400).json({ error: 'walletAddress, token0, token1, liquidity required' });
    }
    const networkChainId = parseInt(chainId) || 84532;
    const { rows } = await dbPool.query(
      `INSERT INTO positions
         (wallet_address, pool_id, position_token_id, token0, token1, liquidity, amount0, amount1,
          fee_tier, pool_address, tick_lower, tick_upper, status, chain_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'0x0000000000000000000000000000000000000000',0,0,'active',$10)
       RETURNING *`,
      [walletAddress.toLowerCase(), poolId || null, positionTokenId || null,
       token0, token1, liquidity, amount0 || 0, amount1 || 0, feeTier || 3000, networkChainId]
    );
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

/**
 * Portfolio API routes — pool creation, transactions, agent wallets
 */
import { Router, Request, Response } from 'express';
import { pool as dbPool } from '../db/index';

const router = Router();

// ─── Pools ────────────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const { rows } = await dbPool.query(
      `SELECT * FROM pools WHERE chain_id = 84532 ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pools' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { token0, token1, feeTier, creatorAddress, txHash } = req.body;
    if (!token0 || !token1 || !feeTier || !creatorAddress || !txHash) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const { rows } = await dbPool.query(
      `INSERT INTO pools (token0, token1, fee_tier, creator_address, tx_hash, chain_id)
       VALUES ($1,$2,$3,$4,$5,84532) RETURNING *`,
      [token0, token1, feeTier, creatorAddress.toLowerCase(), txHash]
    );
    res.status(201).json(rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to save pool', detail: msg });
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
    const { walletAddress, type, txHash, tokenIn, tokenOut, amountIn, amountOut, poolId } = req.body;
    if (!walletAddress || !type || !txHash) {
      return res.status(400).json({ error: 'walletAddress, type, txHash required' });
    }
    const baseScanUrl = `https://sepolia.basescan.org/tx/${txHash}`;
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
    const { agentWalletId, type, txHash, tokenIn, tokenOut, amountIn, amountOut } = req.body;
    if (!agentWalletId || !type || !txHash) {
      return res.status(400).json({ error: 'agentWalletId, type, txHash required' });
    }
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

export default router;

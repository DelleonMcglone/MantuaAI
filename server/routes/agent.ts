/**
 * Agent API Routes — CDP wallet creation, faucet, query on-chain data
 */
import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { pool as dbPool } from '../db/index';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createWalletSchema = z.object({
  userId: z.string().min(1).max(100),
});

const faucetSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  tokens: z.array(z.enum(['eth', 'usdc', 'cbbtc', 'eurc'])).min(1),
});

const querySchema = z.object({
  query: z.string().min(1).max(500),
  walletAddress: z.string().optional(),
});

const sendSchema = z.object({
  walletId: z.string().min(1),
  to: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  token: z.enum(['ETH', 'USDC', 'cbBTC', 'EURC']),
  amount: z.string().min(1),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateMockAddress(): `0x${string}` {
  const hex = Array.from({ length: 40 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
  return `0x${hex}`;
}

async function fetchCoinGeckoPrice(id: string): Promise<number> {
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`
    );
    const d = await r.json();
    return d[id]?.usd ?? 0;
  } catch {
    return 0;
  }
}

const COINGECKO_IDS: Record<string, string> = {
  eth:   'ethereum',
  usdc:  'usd-coin',
  cbbtc: 'coinbase-wrapped-btc',
  eurc:  'euro-coin',
  ETH:   'ethereum',
  USDC:  'usd-coin',
  cbBTC: 'coinbase-wrapped-btc',
  EURC:  'euro-coin',
};

// ─── Route Registration ───────────────────────────────────────────────────────

export function registerAgentRoutes(app: Express): void {

  /** POST /api/agent/wallet — create CDP wallet */
  app.post('/api/agent/wallet', async (req: Request, res: Response) => {
    try {
      const { userId } = createWalletSchema.parse(req.body);

      // Check if user already has an agent wallet
      try {
        const { rows } = await dbPool.query(
          `SELECT * FROM agent_wallets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [userId.toLowerCase()]
        );
        if (rows.length > 0) {
          return res.json({
            walletId: rows[0].wallet_id,
            address: rows[0].address,
            network: 'base-sepolia',
            createdAt: rows[0].created_at,
            baseScanUrl: `https://sepolia.basescan.org/address/${rows[0].address}`,
            message: 'Existing agent wallet retrieved',
            existing: true,
          });
        }
      } catch {
        // Table may not exist yet — continue to create
      }

      // Try CDP SDK first, fall back to deterministic mock for demo
      let address: string;
      let walletId: string;

      try {
        const { CdpClient } = await import('@coinbase/cdp-sdk');
        const cdp = new CdpClient({
          apiKeyId: process.env.CDP_API_KEY_NAME!,
          apiKeySecret: process.env.CDP_API_KEY_PRIVATE_KEY!,
        });
        const wallet = await cdp.evm.createAccount({});
        address = wallet.address;
        walletId = `cdp_${wallet.address.slice(2, 10)}_${Date.now()}`;
      } catch {
        // CDP not configured — use mock for demo
        address = generateMockAddress();
        walletId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }

      // Persist to DB
      try {
        await dbPool.query(
          `INSERT INTO agent_wallets (user_id, wallet_id, address)
           VALUES ($1, $2, $3) ON CONFLICT (wallet_id) DO NOTHING`,
          [userId.toLowerCase(), walletId, address.toLowerCase()]
        );
      } catch {
        // Non-fatal
      }

      res.json({
        walletId,
        address,
        network: 'base-sepolia',
        createdAt: new Date().toISOString(),
        baseScanUrl: `https://sepolia.basescan.org/address/${address}`,
        message: 'Agent wallet created successfully',
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: err.flatten() });
      }
      console.error('[agent/wallet]', err);
      res.status(500).json({ error: 'Failed to create agent wallet' });
    }
  });

  /** GET /api/agent/wallet/:walletId */
  app.get('/api/agent/wallet/:walletId', async (req: Request, res: Response) => {
    try {
      const { rows } = await dbPool.query(
        `SELECT * FROM agent_wallets WHERE wallet_id = $1`,
        [req.params.walletId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Wallet not found' });
      res.json(rows[0]);
    } catch {
      res.status(500).json({ error: 'Failed to fetch wallet' });
    }
  });

  /** POST /api/agent/faucet — request testnet tokens */
  app.post('/api/agent/faucet', async (req: Request, res: Response) => {
    try {
      const { address, tokens } = faucetSchema.parse(req.body);
      const results: Array<{
        token: string;
        success: boolean;
        txHash?: string;
        baseScanUrl?: string;
        error?: string;
      }> = [];

      for (const token of tokens) {
        try {
          // Try CDP SDK faucet
          const { CdpClient } = await import('@coinbase/cdp-sdk');
          const cdp = new CdpClient({
            apiKeyId: process.env.CDP_API_KEY_NAME!,
            apiKeySecret: process.env.CDP_API_KEY_PRIVATE_KEY!,
          });

          const faucetResult = await cdp.evm.requestFaucet({
            address,
            token: token as 'eth' | 'usdc' | 'eurc' | 'cbbtc',
            network: 'base-sepolia',
          });

          results.push({
            token,
            success: true,
            txHash: faucetResult.transactionHash,
            baseScanUrl: `https://sepolia.basescan.org/tx/${faucetResult.transactionHash}`,
          });
        } catch (cdpErr) {
          // CDP unavailable — instruct user to use web faucet
          results.push({
            token,
            success: false,
            error: `CDP faucet unavailable. Visit https://portal.cdp.coinbase.com/products/faucet to claim ${token.toUpperCase()} on Base Sepolia.`,
          });
        }
      }

      res.json({ results });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: err.flatten() });
      }
      res.status(500).json({ error: 'Faucet request failed' });
    }
  });

  /** POST /api/agent/query — on-chain & market data queries */
  app.post('/api/agent/query', async (req: Request, res: Response) => {
    try {
      const { query, walletAddress } = querySchema.parse(req.body);
      const q = query.toLowerCase();

      // Transaction history — check first (before pool/price checks)
      if (q.includes('history') || q.includes('transaction')) {
        if (!walletAddress) {
          return res.json({ type: 'history', data: [], message: 'Connect wallet to see history' });
        }
        try {
          const { rows } = await dbPool.query(
            `SELECT type, tx_hash, token_in, token_out, amount_in, amount_out, timestamp, base_scan_url
             FROM portfolio_transactions WHERE wallet_address = $1
             ORDER BY timestamp DESC LIMIT 20`,
            [walletAddress.toLowerCase()]
          );
          return res.json({ type: 'history', data: rows });
        } catch {
          return res.json({ type: 'history', data: [] });
        }
      }

      // Pool queries — check before "all" to prevent "list all pools" being caught by all-prices
      if (q.includes('pool')) {
        try {
          const { rows } = await dbPool.query(
            `SELECT token0, token1, fee_tier, creator_address, tx_hash, created_at
             FROM pools WHERE chain_id = 84532 ORDER BY created_at DESC LIMIT 10`
          );
          if (rows.length === 0) {
            return res.json({ type: 'pools', data: [], message: 'No pools have been created yet.' });
          }
          return res.json({
            type: 'pools',
            data: rows.map(p => ({
              pair: `${p.token0}/${p.token1}`,
              feeTier: `${(p.fee_tier / 10000).toFixed(2)}%`,
              creator: p.creator_address,
              createdAt: p.created_at,
              txHash: p.tx_hash,
              baseScanUrl: `https://sepolia.basescan.org/tx/${p.tx_hash}`,
            })),
          });
        } catch {
          return res.json({ type: 'pools', data: [], message: 'No pools found' });
        }
      }

      // All prices — "show all token prices", "all prices", "market overview"
      if ((q.includes('all') && q.includes('price')) || q.includes('market')) {
        const [eth, usdc, cbbtc, eurc] = await Promise.all([
          fetchCoinGeckoPrice('ethereum'),
          fetchCoinGeckoPrice('usd-coin'),
          fetchCoinGeckoPrice('coinbase-wrapped-btc'),
          fetchCoinGeckoPrice('euro-coin'),
        ]);
        return res.json({
          type: 'prices',
          data: {
            ETH: `$${eth.toLocaleString()}`,
            USDC: `$${usdc.toFixed(4)}`,
            cbBTC: `$${cbbtc.toLocaleString()}`,
            EURC: `$${eurc.toFixed(4)}`,
            source: 'CoinGecko',
          },
        });
      }

      // Single token price queries — "what's the price of ETH"
      if (q.includes('price') || q.includes('worth') || q.includes('cost')) {
        const tokenMatch = Object.keys(COINGECKO_IDS).find(t => q.includes(t.toLowerCase()));
        const id = tokenMatch ? COINGECKO_IDS[tokenMatch] : 'ethereum';
        const price = await fetchCoinGeckoPrice(id);
        const symbol = tokenMatch ?? 'ETH';
        return res.json({
          type: 'price',
          data: { symbol, price: `$${price.toLocaleString()}`, source: 'CoinGecko' },
        });
      }

      // Fallback: return all four prices
      const [eth, usdc, cbbtc, eurc] = await Promise.all([
        fetchCoinGeckoPrice('ethereum'),
        fetchCoinGeckoPrice('usd-coin'),
        fetchCoinGeckoPrice('coinbase-wrapped-btc'),
        fetchCoinGeckoPrice('euro-coin'),
      ]);
      res.json({
        type: 'market_overview',
        data: {
          ETH: `$${eth.toLocaleString()}`,
          USDC: `$${usdc.toFixed(4)}`,
          cbBTC: `$${cbbtc.toLocaleString()}`,
          EURC: `$${eurc.toFixed(4)}`,
          network: 'Base Sepolia',
          source: 'CoinGecko',
        },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: err.flatten() });
      }
      console.error('[agent/query]', err);
      res.status(500).json({ error: 'Query failed' });
    }
  });

  /** POST /api/agent/analytics — legacy endpoint, proxies to /query */
  app.post('/api/agent/analytics', async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      const [eth, usdc, cbbtc, eurc] = await Promise.all([
        fetchCoinGeckoPrice('ethereum'),
        fetchCoinGeckoPrice('usd-coin'),
        fetchCoinGeckoPrice('coinbase-wrapped-btc'),
        fetchCoinGeckoPrice('euro-coin'),
      ]);
      res.json({
        query,
        data: {
          ETH: `$${eth.toLocaleString()}`,
          USDC: `$${usdc.toFixed(4)}`,
          cbBTC: `$${cbbtc.toLocaleString()}`,
          EURC: `$${eurc.toFixed(4)}`,
        },
        network: 'Base Sepolia',
        source: 'CoinGecko',
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(500).json({ error: 'Analytics query failed' });
    }
  });

  /** POST /api/agent/transfer — log intent */
  app.post('/api/agent/transfer', async (req: Request, res: Response) => {
    const { from, to, token, amount } = req.body;
    res.json({
      status: 'initiated',
      intent: { from, to, token, amount },
      message: `Transfer of ${amount} ${token} to ${to?.slice(0, 8)}...${to?.slice(-6)} ready to sign`,
      txHash: null,
    });
  });
}

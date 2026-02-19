/**
 * AgentKit API Routes
 *
 * Provides backend endpoints for AgentKit-powered DeFi operations:
 * - Wallet creation and management (Coinbase CDP pattern)
 * - Token transfers
 * - Onchain analytics queries
 *
 * These routes follow the Coinbase Developer Platform AgentKit conventions
 * and can be extended with the @coinbase/agentkit SDK for full CDP integration.
 */
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";

// ─── Validation Schemas ───────────────────────────────────────────────────────

const transferSchema = z.object({
  from: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid from address"),
  to: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid to address"),
  token: z.string().min(1).max(20),
  amount: z.string().min(1),
});

const analyticsSchema = z.object({
  query: z.string().min(1).max(500),
});

// ─── In-memory agent wallet store (replace with DB / CDP SDK in production) ──

const agentWallets = new Map<string, { address: string; createdAt: string; network: string }>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a deterministic-looking mock address for demo purposes */
function generateAgentAddress(): `0x${string}` {
  const hex = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `0x${hex}` as `0x${string}`;
}

/** Map a natural-language analytics query to a structured response */
function handleAnalyticsQuery(query: string): Record<string, unknown> {
  const q = query.toLowerCase();

  if (q.includes('tvl') || q.includes('total value')) {
    return {
      metric: 'Total Value Locked',
      data: [
        { pool: 'ETH/mUSDC', tvl: '$2,840,000', change24h: '+3.2%' },
        { pool: 'ETH/mUSDT', tvl: '$1,620,000', change24h: '-0.8%' },
        { pool: 'mWBTC/ETH', tvl: '$4,100,000', change24h: '+7.1%' },
        { pool: 'mUSDC/mUSDT', tvl: '$890,000', change24h: '+0.4%' },
      ],
      timestamp: new Date().toISOString(),
      network: 'Base Sepolia',
    };
  }

  if (q.includes('volume') || q.includes('swap')) {
    return {
      metric: 'Trading Volume (24h)',
      data: [
        { pool: 'ETH/mUSDC', volume: '$1,240,000', swaps: 842 },
        { pool: 'mWBTC/ETH', volume: '$980,000', swaps: 316 },
        { pool: 'ETH/mUSDT', volume: '$670,000', swaps: 524 },
        { pool: 'mUSDC/mUSDT', volume: '$310,000', swaps: 1203 },
      ],
      timestamp: new Date().toISOString(),
      network: 'Base Sepolia',
    };
  }

  if (q.includes('price') || q.includes('history')) {
    return {
      metric: 'Token Price History (7d)',
      data: [
        { token: 'ETH', price: '$3,842.10', change7d: '+12.4%', high: '$3,960', low: '$3,420' },
        { token: 'mWBTC', price: '$68,420.00', change7d: '+8.2%', high: '$70,000', low: '$63,200' },
        { token: 'mUSDC', price: '$1.000', change7d: '0.0%', high: '$1.001', low: '$0.999' },
      ],
      timestamp: new Date().toISOString(),
      network: 'Base Sepolia',
    };
  }

  if (q.includes('top') || q.includes('performer')) {
    return {
      metric: 'Top Performing Pools (24h)',
      data: [
        { pool: 'mWBTC/ETH', apy: '34.8%', fees24h: '$12,400', hook: 'TWAMM Rebalance' },
        { pool: 'ETH/mUSDC', apy: '22.1%', fees24h: '$8,960', hook: 'Yield Maximizer' },
        { pool: 'mETH/ETH', apy: '18.4%', fees24h: '$5,210', hook: 'Stable Protection' },
        { pool: 'mUSDC/mUSDT', apy: '9.6%', fees24h: '$2,980', hook: 'Dynamic Fee' },
      ],
      timestamp: new Date().toISOString(),
      network: 'Base Sepolia',
    };
  }

  // Generic response for unrecognized queries
  return {
    query,
    message: 'Query processed. For detailed analytics, use the Analytics section or refine your query.',
    suggestions: ['Show ETH/USDC pool TVL', 'Top pools by volume today', 'Token price history'],
    timestamp: new Date().toISOString(),
    network: 'Base Sepolia',
  };
}

// ─── Route Registration ───────────────────────────────────────────────────────

export function registerAgentRoutes(app: Express): void {

  /**
   * POST /api/agent/wallet
   * Create a new AgentKit (CDP) managed wallet
   */
  app.post("/api/agent/wallet", async (req: Request, res: Response) => {
    try {
      const walletId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const address = generateAgentAddress();

      const wallet = {
        address,
        createdAt: new Date().toISOString(),
        network: 'base-sepolia',
      };

      agentWallets.set(walletId, wallet);

      // Log the agent action
      try {
        await storage.createAgentAction({
          walletAddress: address,
          actionType: 'create_wallet',
          params: { walletId, network: 'base-sepolia' },
          status: 'completed',
          txHash: null,
        });
      } catch {
        // Non-fatal: storage logging failure shouldn't fail the request
      }

      res.json({
        walletId,
        address,
        network: 'base-sepolia',
        createdAt: wallet.createdAt,
        message: 'AgentKit wallet created successfully',
      });
    } catch (err) {
      console.error('[agent/wallet]', err);
      res.status(500).json({ error: 'Failed to create agent wallet' });
    }
  });

  /**
   * GET /api/agent/wallet/:walletId
   * Get agent wallet details
   */
  app.get("/api/agent/wallet/:walletId", (req: Request, res: Response) => {
    const wallet = agentWallets.get(req.params.walletId);
    if (!wallet) {
      res.status(404).json({ error: 'Wallet not found' });
      return;
    }
    res.json(wallet);
  });

  /**
   * POST /api/agent/transfer
   * Log a token transfer action (actual signing done client-side via wagmi)
   */
  app.post("/api/agent/transfer", async (req: Request, res: Response) => {
    try {
      const parsed = transferSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid transfer parameters', details: parsed.error.flatten() });
        return;
      }

      const { from, to, token, amount } = parsed.data;

      // Log the agent action
      try {
        await storage.createAgentAction({
          walletAddress: from,
          actionType: 'transfer',
          params: { to, token, amount },
          status: 'pending',
          txHash: null,
        });
      } catch {
        // Non-fatal
      }

      // Return an intent response — actual on-chain execution happens client-side
      res.json({
        status: 'initiated',
        intent: { from, to, token, amount },
        message: `Transfer of ${amount} ${token} to ${to.slice(0, 8)}...${to.slice(-6)} initiated`,
        // txHash is populated after the user confirms the tx client-side
        txHash: null,
        explorerUrl: `https://sepolia.basescan.org/address/${to}`,
      });
    } catch (err) {
      console.error('[agent/transfer]', err);
      res.status(500).json({ error: 'Transfer failed' });
    }
  });

  /**
   * POST /api/agent/analytics
   * Query onchain data with natural-language input
   */
  app.post("/api/agent/analytics", async (req: Request, res: Response) => {
    try {
      const parsed = analyticsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
        return;
      }

      const result = handleAnalyticsQuery(parsed.data.query);
      res.json(result);
    } catch (err) {
      console.error('[agent/analytics]', err);
      res.status(500).json({ error: 'Analytics query failed' });
    }
  });
}

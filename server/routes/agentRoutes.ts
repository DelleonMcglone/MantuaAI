/**
 * agentRoutes.ts
 * AgentKit-powered /api/agent/* endpoints for Mantua.AI.
 * Uses CdpEvmWalletProvider (CDP v2) via the singleton in server/lib/agentkit.ts.
 *
 * Endpoints:
 *   GET  /api/agent/wallet          — get agent wallet address + balance (AgentKit)
 *   POST /api/agent/chat            — price/market chat via OpenAI + CoinGecko (no CDP needed)
 *   POST /api/agent/autonomous      — send a message, agent detects intent and acts
 *   POST /api/agent/create-pool     — create Stable Protection pool on Base Sepolia
 */

import { Router } from "express";
import OpenAI from "openai";
import { runAgent, getAgentWalletInfo } from "../lib/agentkit";
import { createStableProtectionPool, swapViaStablePool, getStablePoolId } from "../services/poolService";
import { detectIntent } from "../services/intentRouter";
import { getAllTokenPrices, formatTokenPrice } from "../services/coinGeckoService";

// OpenAI client using Replit AI integration (same as main chat)
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const router = Router();

// ── Per-variable config check — returns specific missing var or null ───────────
function configCheck(): string | null {
  if (!process.env.CDP_API_KEY_ID)     return "CDP_API_KEY_ID is missing from environment";
  if (!process.env.CDP_API_KEY_SECRET) return "CDP_API_KEY_SECRET is missing from environment";
  if (!process.env.CDP_WALLET_SECRET)  return "CDP_WALLET_SECRET is missing from environment";
  if (!process.env.ANTHROPIC_API_KEY)  return "ANTHROPIC_API_KEY is missing from environment";
  return null;
}

function logEnvState(label: string) {
  console.log(`[AgentKit] ${label}:`, {
    CDP_API_KEY_ID:     process.env.CDP_API_KEY_ID     ? `SET (${process.env.CDP_API_KEY_ID.slice(0, 8)}...)` : 'MISSING',
    CDP_API_KEY_SECRET: process.env.CDP_API_KEY_SECRET ? 'SET' : 'MISSING',
    CDP_WALLET_SECRET:  process.env.CDP_WALLET_SECRET  ? 'SET' : 'MISSING',
    ANTHROPIC_API_KEY:  process.env.ANTHROPIC_API_KEY  ? 'SET' : 'MISSING',
  });
}

// ── GET /api/agent/wallet ─────────────────────────────────────────────────────
// Returns wallet address and ETH balance via AgentKit ReAct agent.
router.get("/wallet", async (req, res) => {
  logEnvState('GET /wallet');
  const cfgErr = configCheck();
  if (cfgErr) {
    console.error('[AgentKit] GET /wallet — config error:', cfgErr);
    return res.status(503).json({ success: false, error: 'Agent not configured', details: cfgErr });
  }

  try {
    const response = await runAgent(
      "Get my wallet details including address and ETH balance. " +
      "Format the response with: Address: 0x... and Balance: X ETH and the BaseScan link."
    );
    return res.json({ success: true, response });
  } catch (err: any) {
    const msg = err?.message ?? 'Unknown error';
    console.error("[agentkit] GET /wallet error:", msg);
    if (msg.includes('Invalid') || msg.includes('401') || msg.includes('unauthorized')) {
      return res.status(401).json({ success: false, error: 'Invalid API credentials', message: msg });
    }
    return res.status(500).json({ success: false, error: msg });
  }
});

// ── GET /api/agent/wallet-info ────────────────────────────────────────────────
// Lightweight wallet info without LLM call.
router.get("/wallet-info", async (_req, res) => {
  try {
    const info = await getAgentWalletInfo();
    return res.json(info);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to get wallet info',
      message: err?.message,
    });
  }
});

// ── POST /api/agent/chat ──────────────────────────────────────────────────────
// Price & market analysis chat — uses OpenAI + live CoinGecko data.
// Does NOT require CDP or ANTHROPIC_API_KEY — works with Replit AI integration.
// Body: { message: string }
router.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ success: false, error: "AI not configured. Please set OPENAI_API_KEY." });
  }

  // Fetch live prices to inject as context
  let priceContext = "";
  try {
    const prices = await getAllTokenPrices();
    priceContext =
      "Current live market data (from CoinGecko, mainnet pricing):\n" +
      prices.map(formatTokenPrice).join("\n") + "\n\n" +
      "Additional context:\n" +
      "- EURC is a EUR-pegged stablecoin. Its USD peg is approximately 1 EUR ≈ 1.06–1.10 USD depending on FX.\n" +
      "- USDC is a USD stablecoin, target price $1.00.\n" +
      "- Mantua.AI runs on Base Sepolia testnet with a USDC/EURC Stable Protection pool using Uniswap v4 hooks.\n" +
      "- The Stable Protection Hook adjusts fees based on EURC peg deviation (0.5 bps healthy → circuit breaker at >5% deviation).";
  } catch (err: any) {
    console.warn("[agent/chat] CoinGecko price fetch failed:", err?.message);
    priceContext =
      "Live price data is temporarily unavailable (CoinGecko API error). Use your best knowledge of approximate current crypto market prices.\n" +
      "For reference, approximate price ranges as of early 2025: ETH ~$2,000–3,500, cbBTC ~$60,000–95,000, USDC = $1.00, EURC ≈ $1.06–1.10.\n" +
      "Always note that prices may be outdated and users should verify on-chain or on an exchange.\n\n" +
      "Mantua.AI context: USDC/EURC Stable Protection pool on Base Sepolia with Uniswap v4 hooks.\n" +
      "The Stable Protection Hook adjusts fees dynamically based on EURC peg deviation.";
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are the Mantua.AI market analysis assistant. You specialize in DeFi price data, stablecoin analysis, and Uniswap v4 liquidity insights.\n\n" +
            priceContext + "\n\n" +
            "Answer user questions about prices, market trends, and DeFi yields concisely and accurately. " +
            "Format numbers with commas and 2 decimal places. Use markdown for clarity. " +
            "If asked about on-chain actions (swap, add liquidity, create wallet), explain what Mantua.AI can do but note those require the Agent panel.",
        },
        { role: "user", content: message },
      ],
      max_tokens: 600,
      temperature: 0.3,
    });

    const response = completion.choices[0]?.message?.content ?? "No response generated.";
    return res.json({ success: true, response });
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    console.error("[agent/chat] OpenAI error:", msg);
    return res.status(500).json({ success: false, error: msg });
  }
});

// ── POST /api/agent/autonomous ────────────────────────────────────────────────
// Autonomous mode — agent detects intent and acts without guided prompts.
// Body: { message: string }
router.post("/autonomous", async (req, res) => {
  logEnvState('POST /autonomous');
  const cfgErr = configCheck();
  if (cfgErr) {
    console.error('[AgentKit] POST /autonomous — config error:', cfgErr);
    return res.status(503).json({ success: false, error: 'Agent not configured', details: cfgErr });
  }

  const { message } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const intent = detectIntent(message);

  // Handle pool creation — custom viem action, not in AgentKit tools
  if (intent.type === "create-pool") {
    try {
      const result = await createStableProtectionPool();
      const alreadyExisted = result.transactionHash === "pool-already-exists";
      return res.json({
        success: true,
        intent: "create-pool",
        response:
          (alreadyExisted
            ? `✅ USDC/EURC Stable Protection pool is already live on Base Sepolia!\n\n`
            : `✅ USDC/EURC Stable Protection pool created on Base Sepolia!\n\nTransaction: ${result.explorerUrl}\n`) +
          `Pool ID: ${result.poolId}\n` +
          `Hook: 0xB5faDA071CD56b3F56632F6771356C3e3834a0C0\n` +
          `Fee: DYNAMIC (Stable Protection — 1-100 bps based on peg zone)\n` +
          `Pair: USDC / EURC\n\n` +
          `The Stable Protection Hook monitors peg deviation in real time:\n` +
          `• HEALTHY (≤0.1%): 0.5 bps fee\n` +
          `• MINOR (≤0.5%): 2.5 bps fee\n` +
          `• MODERATE (≤2%): 7.5 bps fee\n` +
          `• SEVERE (≤5%): 150 bps fee\n` +
          `• CRITICAL (>5%): circuit breaker — swaps blocked`,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Handle swap via Stable Protection pool
  if (intent.type === "swap-stable-pool") {
    const fromToken = intent.fromToken ?? "USDC";
    const toToken   = intent.toToken   ?? "EURC";
    const amount    = intent.amount    ?? "1";
    try {
      const result = await swapViaStablePool(fromToken, amount);
      return res.json({
        success: true,
        intent: "swap-stable-pool",
        response:
          `✅ Swapped ${amount} ${fromToken} → ${toToken} via Stable Protection pool!\n\n` +
          `Transaction: ${result.explorerUrl}\n` +
          `Hook: 0xB5faDA071CD56b3F56632F6771356C3e3834a0C0\n` +
          `Pool ID: ${getStablePoolId()}\n\n` +
          `The dynamic fee was automatically adjusted by the Stable Protection Hook based on current peg deviation.`,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Build enriched message based on intent for cleaner agent behavior
  let enrichedMessage = message;
  switch (intent.type) {
    case "create-wallet":
      enrichedMessage =
        "Get my wallet details including address, network, and ETH balance. " +
        "Show the BaseScan link to the address.";
      break;
    case "get-funds":
      enrichedMessage =
        "The user is asking about getting testnet tokens. " +
        "Try to request testnet ETH from the faucet for my wallet using request_faucet_funds. " +
        "Also show the user all available faucet links for the current chain. " +
        "Show the transaction hash and the full BaseScan link if successful.";
      break;
    case "swap":
    case "send":
    case "query":
    case "unknown":
    default:
      // Pass through — agent extracts params or handles naturally
      break;
  }

  try {
    const response = await runAgent(enrichedMessage);
    return res.json({ success: true, intent: intent.type, response });
  } catch (err: any) {
    console.error("[agentkit] POST /autonomous error:", JSON.stringify({
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
    }));
    return res.status(500).json({ success: false, error: err?.message ?? 'Unknown error' });
  }
});

// ── POST /api/agent/create-pool ───────────────────────────────────────────────
// Creates USDC/EURC pool with Stable Protection Hook on Base Sepolia.
router.post("/create-pool", async (req, res) => {
  try {
    const result = await createStableProtectionPool();
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[agentkit] POST /create-pool error:", JSON.stringify({
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
    }));
    return res.status(500).json({ success: false, error: err?.message ?? 'Unknown error' });
  }
});

export default router;

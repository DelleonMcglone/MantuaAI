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
import { getAllTokenPrices, getTokenPriceHistory, formatTokenPrice } from "../services/coinGeckoService";

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
  const hasOpenAI = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const hasAnthropic = process.env.ANTHROPIC_API_KEY;
  if (!hasOpenAI && !hasAnthropic) return "No LLM API key found (set OPENAI_API_KEY or ANTHROPIC_API_KEY)";
  return null;
}

function logEnvState(label: string) {
  console.log(`[AgentKit] ${label}:`, {
    CDP_API_KEY_ID:                 process.env.CDP_API_KEY_ID                 ? `SET (${process.env.CDP_API_KEY_ID.slice(0, 8)}...)` : 'MISSING',
    CDP_API_KEY_SECRET:             process.env.CDP_API_KEY_SECRET             ? 'SET' : 'MISSING',
    CDP_WALLET_SECRET:              process.env.CDP_WALLET_SECRET              ? 'SET' : 'MISSING',
    AI_INTEGRATIONS_OPENAI_API_KEY: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? 'SET' : 'MISSING',
    OPENAI_API_KEY:                 process.env.OPENAI_API_KEY                 ? 'SET' : 'MISSING',
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
    if (msg.includes('Invalid key format') || msg.includes('PEM EC key') || msg.includes('Ed25519')) {
      return res.status(503).json({
        success: false,
        error: 'CDP credentials need updating',
        message: 'CDP API key is in v1 format. Regenerate at portal.cdp.coinbase.com and update CDP_API_KEY_SECRET.',
      });
    }
    if (msg.includes('401') || msg.includes('unauthorized')) {
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
// Action-aware chat endpoint.
// - When `action` is present (from the Agent modal tile): routes through the
//   AgentKit ReAct agent (runAgent) so CDP tools are actually called.
// - When no action (from the Analytics panel): uses OpenAI + live CoinGecko data.
// Body: { message: string, action?: string }
router.post("/chat", async (req, res) => {
  const { message, action } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  // ── Action-based requests → AgentKit ReAct agent ────────────────────────────
  // Any tile-triggered chat (action present) MUST use the full AgentKit agent so
  // that CDP tools (get_wallet_details, request_faucet_funds, swap_assets, etc.)
  // are actually invoked. OpenAI does not have access to these tools.
  if (action) {
    const cfgErr = configCheck();
    if (cfgErr) {
      console.error('[AgentKit] POST /chat — config error:', cfgErr);
      return res.status(503).json({ success: false, error: 'Agent not configured', details: cfgErr });
    }

    // Map action tokens to enriched messages matching intent-router behaviour
    let enrichedMessage = message;
    if (action === 'create-wallet') {
      enrichedMessage =
        "Get my wallet details including address, network, and ETH balance. " +
        "Show the BaseScan link to the address.";
    } else if (action === 'get-funds') {
      enrichedMessage =
        "Try to request testnet ETH from the faucet for my wallet using request_faucet_funds. " +
        "Also show all available faucet links for the current chain. " +
        "Show the transaction hash and the full BaseScan link if successful.";
    }
    // 'swap', 'send', 'query', 'create-pool' and anything else pass through as-is

    try {
      const response = await runAgent(enrichedMessage);
      return res.json({ success: true, response });
    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error';
      console.error('[agent/chat] runAgent error:', msg);

      // Translate low-level CDP/LLM errors into user-readable chat responses
      // so the Agent modal shows a helpful message rather than a raw error.
      let friendlyResponse: string | null = null;

      if (msg.includes('Invalid key format') || msg.includes('PEM EC key') || msg.includes('Ed25519')) {
        friendlyResponse =
          '⚠️ **CDP credentials need updating**\n\n' +
          'Your CDP API key is in the v1 format, but the current AgentKit SDK (v2) requires a key in **PEM EC** or **base64 Ed25519** format.\n\n' +
          '**To fix:**\n' +
          '1. Go to [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com/)\n' +
          '2. Generate a new API key — download the JSON file\n' +
          '3. Update `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` in your Replit Secrets with the new values\n\n' +
          'In the meantime you can still use the **Analytics** panel for live price data.';
      } else if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('forbidden')) {
        friendlyResponse =
          '⚠️ **CDP authentication failed**\n\n' +
          'The CDP API key was rejected. Please verify `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` are correct at [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com/).';
      } else if (msg.includes('Missing required') || msg.includes('not configured')) {
        friendlyResponse =
          '⚠️ **Agent not configured**\n\n' +
          'CDP credentials are missing from environment. Set `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, and `CDP_WALLET_SECRET` in Replit Secrets.';
      }

      if (friendlyResponse) {
        return res.json({ success: true, response: friendlyResponse });
      }
      return res.status(500).json({ success: false, error: msg });
    }
  }

  // ── No action → market analysis via OpenAI (Analytics panel) ───────────────
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback: if Anthropic is configured, use it for market queries too
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const response = await runAgent(message);
        return res.json({ success: true, response });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message ?? 'Unknown error' });
      }
    }
    return res.status(503).json({ success: false, error: "AI not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY." });
  }

  // Fetch live prices + EUR/USD FX + EURC 24h history — all in parallel
  let priceContext = "";
  try {
    const [prices, eurcHistory] = await Promise.all([
      getAllTokenPrices(),
      getTokenPriceHistory("EURC", 1).catch(() => null),
    ]);

    // Fetch live EUR/USD rate for EURC peg analysis
    let eurUsd = 1.085; // fallback
    try {
      const fxRes = await fetch("https://open.er-api.com/v6/latest/EUR");
      if (fxRes.ok) {
        const fxData = await fxRes.json() as { rates: { USD: number } };
        if (fxData?.rates?.USD) eurUsd = fxData.rates.USD;
      }
    } catch {
      // use fallback
    }

    const eurc = prices.find(p => p.token === "EURC");
    const eurcDeviation = eurc ? ((eurc.usd - eurUsd) / eurUsd) * 100 : 0;
    const eurcDirection = eurcDeviation >= 0 ? "above" : "below";
    const eurcAbs = Math.abs(eurcDeviation);
    const eurcStatus = eurcAbs < 0.1 ? "within normal range" : eurcAbs < 0.5 ? "slight deviation" : "significant deviation";

    // Build EURC 24h deviation summary from historical prices
    let eurcHistorySummary = "EURC 24h price history: not available";
    if (eurcHistory && eurcHistory.prices.length > 1) {
      const pts = eurcHistory.prices.map(p => p.price);
      const min24h = Math.min(...pts);
      const max24h = Math.max(...pts);
      const open24h = pts[0];
      const close24h = pts[pts.length - 1];
      const change24h = ((close24h - open24h) / open24h) * 100;
      const sign = change24h >= 0 ? "+" : "";
      // Express deviation from EUR/USD peg for each point
      const minDev = ((min24h - eurUsd) / eurUsd) * 100;
      const maxDev = ((max24h - eurUsd) / eurUsd) * 100;
      eurcHistorySummary =
        `EURC 24h price history (vs EUR/USD peg $${eurUsd.toFixed(4)}):\n` +
        `  Price range: $${min24h.toFixed(4)} – $${max24h.toFixed(4)}\n` +
        `  24h open: $${open24h.toFixed(4)} → close: $${close24h.toFixed(4)} (${sign}${change24h.toFixed(4)}%)\n` +
        `  Peg deviation range: ${minDev.toFixed(4)}% to ${maxDev.toFixed(4)}%\n` +
        `  Data points: ${pts.length}`;
    }

    priceContext =
      "=== LIVE MARKET DATA (CoinGecko, fetched now) ===\n" +
      prices.map(formatTokenPrice).join("\n") + "\n\n" +
      `=== EURC PEG ANALYSIS ===\n` +
      `EUR/USD FX rate: $${eurUsd.toFixed(4)}\n` +
      `EURC current price: $${eurc?.usd.toFixed(4) ?? "N/A"}\n` +
      `EURC peg status: ${eurcDirection} peg by ${eurcAbs.toFixed(4)}% (${eurcStatus})\n\n` +
      `=== EURC 24H HISTORY ===\n` +
      eurcHistorySummary + "\n\n" +
      "=== POOL & LIQUIDITY CONTEXT ===\n" +
      `ETH 24h volume (mainnet): $${((prices.find(p => p.token === "ETH")?.usd_24h_vol ?? 0) / 1_000_000_000).toFixed(2)}B\n` +
      `USDC 24h volume (mainnet): $${((prices.find(p => p.token === "USDC")?.usd_24h_vol ?? 0) / 1_000_000_000).toFixed(2)}B\n` +
      `EURC 24h volume (mainnet): $${((prices.find(p => p.token === "EURC")?.usd_24h_vol ?? 0) / 1_000_000).toFixed(1)}M\n` +
      "Mantua.AI pool note: Base Sepolia testnet — pool TVL/liquidity has no real monetary value\n" +
      "USDC: USD stablecoin, target $1.00\n" +
      "EURC: EUR-backed stablecoin — fair USD value = EUR/USD rate above\n" +
      "Stable Protection Hook: 0.5 bps (healthy peg) → circuit breaker at >5% deviation";
  } catch (err: any) {
    console.warn("[agent/chat] price context fetch failed:", err?.message);
    priceContext =
      "Live price data is temporarily unavailable (CoinGecko API error). " +
      "Inform the user that prices cannot be fetched right now and ask them to try again in a moment.";
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
            "IMPORTANT: The live market data above is injected from CoinGecko right now — ALWAYS use these numbers in your answers. " +
            "NEVER answer from training data or memory. NEVER say 'as of early 2025' or give price ranges.\n\n" +
            "Answer rules:\n" +
            "- Current price of a single token → quote the exact USD price from the data above with 2 decimal places\n" +
            "- 24h price change → quote the signed percentage (e.g. ETH: +1.24%, cbBTC: -0.87%) from the data above\n" +
            "- EURC peg / above or below peg → use the EURC peg status line above (direction, deviation %, and EUR/USD rate)\n" +
            "- EURC price deviation over 24h → use the EURC 24h change percentage and note this reflects market movement vs its EUR peg\n" +
            "- ETH/USDC pool liquidity or volume → use the ETH and USDC 24h volume figures above; note pool TVL is on Base Sepolia testnet with no real monetary value\n" +
            "- Best yield for stablecoin liquidity → compare USDC and EURC volumes from above; USDC/EURC Stable Protection pool on Mantua uses dynamic fees (0.5 bps when healthy); give a reasoned recommendation based on the actual volume data\n\n" +
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

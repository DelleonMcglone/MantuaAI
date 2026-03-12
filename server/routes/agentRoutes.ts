/**
 * agentRoutes.ts
 * AgentKit-powered /api/agent/* endpoints for Mantua.AI.
 * Uses CdpEvmWalletProvider (CDP v2) via the singleton in server/lib/agentkit.ts.
 *
 * Endpoints:
 *   GET  /api/agent/wallet          — get agent wallet address + balance (AgentKit)
 *   POST /api/agent/chat            — send a message to the ReAct agent (chat mode)
 *   POST /api/agent/autonomous      — send a message, agent detects intent and acts
 *   POST /api/agent/create-pool     — create Stable Protection pool on Unichain Sepolia
 */

import { Router } from "express";
import { runAgent, getAgentWalletInfo } from "../lib/agentkit";
import { createStableProtectionPool, swapViaStablePool, getStablePoolId } from "../services/poolService";
import { detectIntent } from "../services/intentRouter";

const router = Router();

// ── GET /api/agent/wallet ─────────────────────────────────────────────────────
// Returns wallet address and ETH balance via AgentKit ReAct agent.
router.get("/wallet", async (req, res) => {
  // DIAGNOSTIC — remove after confirming env vars are present
  console.log('[AgentKit] ENV check:', {
    CDP_API_KEY_ID:     !!process.env.CDP_API_KEY_ID,
    CDP_API_KEY_SECRET: !!process.env.CDP_API_KEY_SECRET,
    CDP_WALLET_SECRET:  !!process.env.CDP_WALLET_SECRET,
    ANTHROPIC_API_KEY:  !!process.env.ANTHROPIC_API_KEY,
  });

  try {
    const response = await runAgent(
      "Get my wallet details including address and ETH balance. " +
      "Format the response with: Address: 0x... and Balance: X ETH and the BaseScan link."
    );
    return res.json({ success: true, response });
  } catch (err: any) {
    const msg = err?.message ?? 'Unknown error';
    console.error("[agentkit] GET /wallet error:", msg);

    if (msg.includes('not configured') || msg.includes('Missing required')) {
      return res.status(503).json({
        success: false,
        error: 'Agent not configured',
        message: 'CDP API keys are missing from the server environment.',
        action: 'Add CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET, ' +
                'and ANTHROPIC_API_KEY to your .env file.',
      });
    }

    if (msg.includes('Invalid') || msg.includes('401') || msg.includes('unauthorized')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API credentials',
        message: msg,
      });
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
// Main chat mode endpoint — agent handles any message.
// Body: { message: string, action?: string }
router.post("/chat", async (req, res) => {
  const { message, action } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  // Prepend action context if provided by chat mode card selection
  const contextualMessage = action
    ? `[Action: ${action}] ${message}`
    : message;

  try {
    const response = await runAgent(contextualMessage);
    return res.json({ success: true, response });
  } catch (err: any) {
    const msg = err?.message ?? 'Unknown error';
    console.error("[agentkit] POST /chat error:", msg);

    if (msg.includes('not configured') || msg.includes('Missing required')) {
      return res.status(503).json({
        success: false,
        error: 'Agent not configured',
        message: 'CDP API keys are missing. Add them to your .env file.',
      });
    }

    return res.status(500).json({ success: false, error: msg });
  }
});

// ── POST /api/agent/autonomous ────────────────────────────────────────────────
// Autonomous mode — agent detects intent and acts without guided prompts.
// Body: { message: string }
router.post("/autonomous", async (req, res) => {
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
        "Request testnet ETH from the faucet for my wallet. " +
        "Show the transaction hash and the full BaseScan link.";
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
    console.error("[agentkit] POST /autonomous error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/agent/create-pool ───────────────────────────────────────────────
// Creates USDC/EURC pool with Stable Protection Hook on Unichain Sepolia.
router.post("/create-pool", async (req, res) => {
  try {
    const result = await createStableProtectionPool();
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[agentkit] POST /create-pool error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

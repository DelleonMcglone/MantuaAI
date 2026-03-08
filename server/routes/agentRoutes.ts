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
import { runAgent } from "../lib/agentkit";
import { createStableProtectionPool } from "../services/poolService";
import { detectIntent } from "../services/intentRouter";

const router = Router();

// ── GET /api/agent/wallet ─────────────────────────────────────────────────────
// Returns wallet address and ETH balance via AgentKit ReAct agent.
router.get("/wallet", async (req, res) => {
  try {
    const response = await runAgent(
      "Get my wallet details including address and ETH balance. " +
      "Format the response with: Address: 0x... and Balance: X ETH and the BaseScan link."
    );
    return res.json({ success: true, response });
  } catch (err: any) {
    console.error("[agentkit] GET /wallet error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
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
    console.error("[agentkit] POST /chat error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
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

  // Handle pool creation separately — it's a custom viem action, not in AgentKit tools
  if (intent.type === "create-pool") {
    try {
      const result = await createStableProtectionPool();
      return res.json({
        success: true,
        intent: "create-pool",
        response:
          `Pool created on Unichain Sepolia!\n\n` +
          `Transaction: ${result.explorerUrl}\n` +
          `Pool: ${result.poolKey.currency0}/${result.poolKey.currency1}\n` +
          `Fee: DYNAMIC (0x800000)\n` +
          `Hook: ${result.poolKey.hooks}`,
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

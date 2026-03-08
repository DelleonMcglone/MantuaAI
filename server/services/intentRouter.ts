/**
 * intentRouter.ts
 * Detects user intent from natural language for autonomous mode routing.
 * Used to enrich messages before passing to the AgentKit ReAct agent.
 */

export type IntentType =
  | "create-wallet"
  | "get-funds"
  | "create-pool"
  | "swap"
  | "send"
  | "query"
  | "unknown";

export interface DetectedIntent {
  type: IntentType;
}

const PATTERNS: Array<{ type: IntentType; patterns: RegExp[] }> = [
  {
    type: "create-wallet",
    patterns: [
      /create\s+(?:a\s+)?wallet/i,
      /new\s+wallet/i,
      /set\s+up\s+wallet/i,
      /manage\s+wallet/i,
      /get\s+(?:my\s+)?wallet/i,
      /wallet\s+details/i,
    ],
  },
  {
    type: "get-funds",
    patterns: [
      /get\s+(?:testnet\s+)?(?:eth|funds|tokens)/i,
      /fund\s+(?:my\s+)?wallet/i,
      /faucet/i,
      /request\s+eth/i,
      /testnet\s+eth/i,
      /get\s+me\s+(?:some\s+)?eth/i,
    ],
  },
  {
    type: "create-pool",
    patterns: [
      /create\s+(?:a\s+)?pool/i,
      /new\s+pool/i,
      /stable\s+protection/i,
      /initialize\s+pool/i,
      /deploy\s+pool/i,
    ],
  },
  {
    type: "swap",
    patterns: [
      /swap\s+[\d.]+/i,
      /exchange\s+[\d.]+/i,
      /trade\s+[\d.]+/i,
      /convert\s+[\d.]+/i,
    ],
  },
  {
    type: "send",
    patterns: [
      /send\s+[\d.]+\s+\w+\s+to\s+0x/i,
      /transfer\s+[\d.]+\s+\w+\s+to\s+0x/i,
    ],
  },
  {
    type: "query",
    patterns: [
      /(?:what|show|get)\s+(?:is\s+)?(?:the\s+)?(?:eth|btc|usdc)?\s*price/i,
      /(?:my\s+)?balance/i,
      /how\s+much/i,
      /price\s+of/i,
      /current\s+price/i,
    ],
  },
];

export function detectIntent(message: string): DetectedIntent {
  for (const { type, patterns } of PATTERNS) {
    if (patterns.some(p => p.test(message))) return { type };
  }
  return { type: "unknown" };
}

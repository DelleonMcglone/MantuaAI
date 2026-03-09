/**
 * intentRouter.ts
 * Detects user intent from natural language for autonomous mode routing.
 * Used to enrich messages before passing to the AgentKit ReAct agent.
 */

export type IntentType =
  | "create-wallet"
  | "get-funds"
  | "create-pool"
  | "swap-stable-pool"
  | "swap"
  | "send"
  | "query"
  | "unknown";

export interface DetectedIntent {
  type: IntentType;
  fromToken?: "USDC" | "EURC";
  toToken?: "USDC" | "EURC";
  amount?: string;
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
    // MUST come before create-pool to avoid "stable protection pool" in swap messages
    // matching the create-pool pattern
    type: "swap-stable-pool",
    patterns: [
      /\bswap\b.*\bstable\s+protection\b/i,
      /\bswap\b.*\bstable\s+pool\b/i,
      /\bswap\b.*\bhook\s+pool\b/i,
      /\bstable\s+protection\b.*\bswap\b/i,
      /swap\s+(?:\d+(?:\.\d+)?\s+)?(?:usdc|eurc)\s+(?:for|to|→)\s+(?:eurc|usdc)\s+(?:from|via|using|through|stable|hook)/i,
      /swap\s+(?:\d+(?:\.\d+)?\s+)?(?:usdc|eurc)\s+(?:for|to)\s+(?:eurc|usdc)\s+(?:stable|hook)/i,
    ],
  },
  {
    type: "create-pool",
    patterns: [
      /create\s+(?:a\s+)?(?:usdc[\s/]+eurc|eurc[\s/]+usdc)?\s*pool/i,
      /new\s+(?:usdc[\s/]+eurc|eurc[\s/]+usdc)?\s*pool/i,
      /create\s+.*stable\s+protection/i,
      /stable\s+protection\s+pool/i,
      /initialize\s+(?:a\s+)?pool/i,
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

function parseSwapParams(message: string): Partial<DetectedIntent> {
  const usdcFirst = /swap\s+([\d.]+)\s+usdc\s+(?:for|to|→)\s+eurc/i.exec(message);
  if (usdcFirst) return { fromToken: "USDC", toToken: "EURC", amount: usdcFirst[1] };

  const eurcFirst = /swap\s+([\d.]+)\s+eurc\s+(?:for|to|→)\s+usdc/i.exec(message);
  if (eurcFirst) return { fromToken: "EURC", toToken: "USDC", amount: eurcFirst[1] };

  const anyAmount = /([\d.]+)\s+(?:usdc|eurc)/i.exec(message);
  const fromToken = /\beurc\b.*(?:for|to)/i.test(message) ? "EURC" : "USDC";
  return {
    fromToken,
    toToken: fromToken === "USDC" ? "EURC" : "USDC",
    amount: anyAmount ? anyAmount[1] : "1",
  };
}

export function detectIntent(message: string): DetectedIntent {
  for (const { type, patterns } of PATTERNS) {
    if (patterns.some(p => p.test(message))) {
      const intent: DetectedIntent = { type };
      if (type === "swap-stable-pool") {
        Object.assign(intent, parseSwapParams(message));
      }
      return intent;
    }
  }
  return { type: "unknown" };
}

/**
 * intentRouter.ts
 * Detects user intent from natural language for autonomous mode routing.
 * Used to enrich messages before passing to the AgentKit ReAct agent.
 * Supports 40+ natural language variations for swap and liquidity actions.
 */

export type IntentType =
  | "create-wallet"
  | "get-funds"
  | "create-pool"
  | "add-liquidity"
  | "swap-stable-pool"
  | "swap"
  | "send"
  | "query"
  | "unknown";

type TokenSymbol = "USDC" | "EURC" | "ETH" | "cbBTC" | "tUSDT" | "LINK";

export interface DetectedIntent {
  type: IntentType;
  fromToken?: TokenSymbol;
  toToken?: TokenSymbol;
  amount?: string;
  useStableHook?: boolean;
  chainHint?: number;
}

// ── Hook detection ──────────────────────────────────────────────────────────
const HOOK_PHRASES = [
  'stable protection', 'stable swap hook', 'with hook',
  'hook', 'stable pool', 'using hook', 'with the hook',
];

function detectHook(message: string): boolean {
  const lower = message.toLowerCase();
  return HOOK_PHRASES.some(phrase => lower.includes(phrase));
}

// ── Chain detection ─────────────────────────────────────────────────────────
const CHAIN_HINTS: Record<string, number> = {
  'unichain': 1301, 'unichain sepolia': 1301,
  'base': 84532, 'base sepolia': 84532,
};

function detectChain(message: string): number | undefined {
  const lower = message.toLowerCase();
  for (const [hint, chainId] of Object.entries(CHAIN_HINTS)) {
    if (lower.includes(hint)) return chainId;
  }
  return undefined;
}

// ── Token extraction ────────────────────────────────────────────────────────
const TOKEN_RE = /\b(USDC|t?USDT|EURC|ETH|cbBTC|LINK)\b/gi;

function normalizeSymbol(raw: string): TokenSymbol {
  const upper = raw.toUpperCase();
  // Normalize bare "USDT" to "tUSDT" (testnet Tether on Unichain)
  if (upper === 'USDT') return 'tUSDT';
  if (upper === 'TUSDT') return 'tUSDT';
  return upper as TokenSymbol;
}

function extractTokens(message: string): TokenSymbol[] {
  const matches = message.match(TOKEN_RE) ?? [];
  return [...new Set(matches.map(normalizeSymbol))];
}

// ── Amount extraction ───────────────────────────────────────────────────────
const AMOUNT_RE = /(\d+\.?\d*)\s*(?:USDC|t?USDT|EURC|ETH|cbBTC|LINK)/i;

function extractAmount(message: string): string | undefined {
  const match = AMOUNT_RE.exec(message);
  return match ? match[1] : undefined;
}

// ── Pattern matching ────────────────────────────────────────────────────────
const PATTERNS: Array<{ type: IntentType; patterns: RegExp[] }> = [
  {
    type: "create-wallet",
    patterns: [
      /create\s+(?:a\s+)?wallet/i,
      /new\s+wallet/i,
      /set\s+up\s+wallet/i,
      /manage\s+(?:a\s+)?wallet/i,
      /get\s+(?:my\s+)?wallet/i,
      /wallet\s+details/i,
      /show\s+(?:me\s+)?(?:my\s+)?wallet/i,
      /\bwallet\b.*\baddress\b/i,
      /\baddress\b.*\bwallet\b/i,
    ],
  },
  {
    type: "get-funds",
    patterns: [
      /get\s+(?:testnet\s+)?(?:eth|funds|tokens)/i,
      /fund\s+(?:my\s+)?wallet/i,
      /faucet/i,
      /request\s+(?:testnet\s+)?eth/i,
      /testnet\s+(?:eth|funds)/i,
      /get\s+me\s+(?:some\s+)?eth/i,
    ],
  },
  {
    // MUST come before create-pool to avoid "stable protection pool" in swap messages
    // matching the create-pool pattern
    type: "swap-stable-pool",
    patterns: [
      /\b(?:swap|convert|trade|exchange)\b.*\bstable\s+protection\b/i,
      /\b(?:swap|convert|trade|exchange)\b.*\bstable\s+(?:pool|hook)\b/i,
      /\b(?:swap|convert|trade|exchange)\b.*\bhook\s+pool\b/i,
      /\bstable\s+protection\b.*\b(?:swap|convert|trade|exchange)\b/i,
      /\b(?:swap|convert|trade|exchange)\b\s+(?:\d+(?:\.\d+)?\s+)?(?:usdc|t?usdt|eurc)\s+(?:for|to|→|into)\s+(?:eurc|usdc|t?usdt)\s+(?:from|via|using|through|with|stable|hook)/i,
    ],
  },
  {
    type: "add-liquidity",
    patterns: [
      /add\s+liquidity/i,
      /provide\s+liquidity/i,
      /supply\s+liquidity/i,
      /\blp\s+(?:into|to)\b/i,
      /deposit\s+into\s+.*pool/i,
      /open\s+(?:a\s+)?(?:new\s+)?(?:\S+[/\s]\S+\s+)?(?:pool\s+)?position/i,
      /\badd\s+(?:\d+\s+)?(?:USDC|USDT|EURC|ETH)\s+and\s+(?:\d+\s+)?(?:USDC|USDT|EURC|ETH)\s+to\s+(?:a\s+)?pool\b/i,
      /\bI\s+want\s+to\s+(?:provide|add)\s+liquidity\b/i,
      /\bI['']?d\s+like\s+to\s+add\s+liquidity\b/i,
      /\badd\s+to\s+(?:the\s+)?(?:\S+\s+)*pool\b/i,
    ],
  },
  {
    type: "create-pool",
    patterns: [
      /create\s+(?:a\s+)?(?:(?:USDC|USDT|EURC)[\s/]+(?:USDC|USDT|EURC)\s+)?(?:stable\s+)?pool/i,
      /new\s+(?:(?:USDC|USDT|EURC)[\s/]+(?:USDC|USDT|EURC)\s+)?pool/i,
      /create\s+.*stable\s+protection/i,
      /stable\s+protection\s+pool/i,
      /initialize\s+(?:a\s+)?pool/i,
      /deploy\s+pool/i,
      /make\s+(?:a\s+)?(?:new\s+)?(?:(?:USDC|USDT|EURC)[\s/]+(?:USDC|USDT|EURC)\s+)?(?:liquidity\s+)?pool/i,
      /start\s+(?:a\s+)?(?:(?:USDC|USDT|EURC)[\s/]+(?:USDC|USDT|EURC)\s+)?pool/i,
      /create\s+pool\s+(?:USDC|USDT|EURC)/i,
      /new\s+pool\s+with\s+stable/i,
    ],
  },
  {
    type: "swap",
    patterns: [
      /\bswap\b\s+[\d.]+/i,
      /\bexchange\b\s+[\d.]+/i,
      /\btrade\b\s+[\d.]+/i,
      /\bconvert\b\s+[\d.]+/i,
      /\bswap\b\s+(?:USDC|t?USDT|EURC|ETH|cbBTC|LINK)\b/i,
      /\bbuy\b\s+(?:USDC|t?USDT|EURC|ETH|cbBTC|LINK)\s+with\b/i,
      /\bsell\b\s+[\d.]+\s+(?:USDC|t?USDT|EURC|ETH|cbBTC|LINK)\b/i,
      /I\s+want\s+to\s+swap/i,
      /\bget\b\s+(?:USDC|t?USDT|EURC|ETH|cbBTC|LINK)\s+for\s+(?:my\s+)?(?:USDC|t?USDT|EURC|ETH|cbBTC|LINK)\b/i,
      /\bconvert\b\s+(?:USDC|t?USDT|EURC|ETH|cbBTC|LINK)\b/i,
      /\bexchange\b\s+(?:USDC|t?USDT|EURC|ETH|cbBTC|LINK)\b/i,
      /\btrade\b\s+(?:USDC|t?USDT|EURC|ETH|cbBTC|LINK)\b/i,
    ],
  },
  {
    type: "send",
    patterns: [
      /\bsend\b\s+[\d.]+\s+\w+\s+to\s+0x/i,
      /\btransfer\b\s+[\d.]+\s+\w+\s+to\s+0x/i,
      /\bpay\b\s+[\d.]+\s+\w+\s+to\s+0x/i,
    ],
  },
  {
    type: "query",
    patterns: [
      /(?:what|show|get)\s+(?:is\s+)?(?:the\s+)?(?:eth|btc|usdc|usdt)?\s*price/i,
      /(?:my\s+)?balance/i,
      /how\s+much/i,
      /price\s+of/i,
      /current\s+price/i,
      /recent\s+transactions/i,
      /transaction\s+history/i,
    ],
  },
];

function parseSwapParams(message: string): Partial<DetectedIntent> {
  const tokens = extractTokens(message);
  const amount = extractAmount(message);

  // Try explicit "X for Y" pattern
  const forPattern = /(\d+\.?\d*)?\s*(USDC|t?USDT|EURC|ETH|cbBTC|LINK)\s+(?:for|to|→|into)\s+(USDC|t?USDT|EURC|ETH|cbBTC|LINK)/i;
  const forMatch = forPattern.exec(message);
  if (forMatch) {
    return {
      fromToken: normalizeSymbol(forMatch[2]),
      toToken: normalizeSymbol(forMatch[3]),
      amount: forMatch[1] || amount || "1",
    };
  }

  // "buy X with Y" pattern
  const buyPattern = /buy\s+(USDC|t?USDT|EURC|ETH|cbBTC|LINK)\s+with\s+(?:(\d+\.?\d*)\s+)?(USDC|t?USDT|EURC|ETH|cbBTC|LINK)/i;
  const buyMatch = buyPattern.exec(message);
  if (buyMatch) {
    return {
      fromToken: normalizeSymbol(buyMatch[3]),
      toToken: normalizeSymbol(buyMatch[1]),
      amount: buyMatch[2] || amount || "1",
    };
  }

  // "sell X for Y" pattern
  const sellPattern = /sell\s+(?:(\d+\.?\d*)\s+)?(USDC|t?USDT|EURC|ETH|cbBTC|LINK)\s+(?:for|to)\s+(USDC|t?USDT|EURC|ETH|cbBTC|LINK)/i;
  const sellMatch = sellPattern.exec(message);
  if (sellMatch) {
    return {
      fromToken: normalizeSymbol(sellMatch[2]),
      toToken: normalizeSymbol(sellMatch[3]),
      amount: sellMatch[1] || amount || "1",
    };
  }

  // "get X for my Y" pattern
  const getPattern = /get\s+(USDC|t?USDT|EURC|ETH|cbBTC|LINK)\s+for\s+(?:my\s+)?(USDC|t?USDT|EURC|ETH|cbBTC|LINK)/i;
  const getMatch = getPattern.exec(message);
  if (getMatch) {
    return {
      fromToken: normalizeSymbol(getMatch[2]),
      toToken: normalizeSymbol(getMatch[1]),
      amount: amount || "1",
    };
  }

  // Fallback: use extracted tokens
  if (tokens.length >= 2) {
    return {
      fromToken: tokens[0],
      toToken: tokens[1],
      amount: amount || "1",
    };
  }

  return { amount: amount || "1" };
}

function parseLiquidityParams(message: string): Partial<DetectedIntent> {
  const tokens = extractTokens(message);
  const useStableHook = detectHook(message);
  const chainHint = detectChain(message);

  // Try pair pattern "USDC/USDT", "USDC USDT", or "USDC, USDT"
  const pairMatch = /\b(USDC|t?USDT|EURC|ETH|cbBTC|LINK)\s*[/\-,\s]\s*(USDC|t?USDT|EURC|ETH|cbBTC|LINK)\b/i.exec(message);
  if (pairMatch) {
    return {
      fromToken: normalizeSymbol(pairMatch[1]),
      toToken: normalizeSymbol(pairMatch[2]),
      useStableHook,
      chainHint,
    };
  }

  if (tokens.length >= 2) {
    return {
      fromToken: tokens[0],
      toToken: tokens[1],
      useStableHook,
      chainHint,
    };
  }

  return { useStableHook, chainHint };
}

export function detectIntent(message: string): DetectedIntent {
  for (const { type, patterns } of PATTERNS) {
    if (patterns.some(p => p.test(message))) {
      const intent: DetectedIntent = { type };
      if (type === "swap-stable-pool" || type === "swap") {
        Object.assign(intent, parseSwapParams(message));
        // Also extract hook and chain hints for swap messages
        intent.useStableHook = intent.useStableHook || detectHook(message);
        intent.chainHint = intent.chainHint || detectChain(message);
      }
      if (type === "create-pool" || type === "add-liquidity") {
        Object.assign(intent, parseLiquidityParams(message));
      }
      return intent;
    }
  }
  return { type: "unknown" };
}

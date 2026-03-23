/**
 * parseSwapIntent.ts
 * Deterministic parser for natural-language swap commands.
 * Maps free-form user input to a SwapIntent struct including:
 *   - tokenIn / tokenOut
 *   - amountIn (raw string or null)
 *   - useStableHook (auto-set for USDC/EURC pairs)
 *   - hookExplicitlyRequested
 *   - confidence level
 *
 * Token universe: ETH, USDC, cbBTC, EURC (Base Sepolia)
 * Stable pairs: USDC/EURC and EURC/USDC → useStableHook = true
 *
 * IMPORTANT: amountSpecified at execution must be NEGATIVE (exact-input).
 * This parser returns the raw positive string — the caller is responsible
 * for negating it before passing to executeSwap().
 */

export type SupportedToken = "ETH" | "USDC" | "cbBTC" | "EURC";

export interface SwapIntent {
  tokenIn: SupportedToken;
  tokenOut: SupportedToken;
  amountIn: string | null;      // positive string; caller negates for exact-input
  useStableHook: boolean;       // true → Stable Protection Hook config
  hookExplicitlyRequested: boolean;
  confidence: "high" | "medium" | "low";
  rawInput: string;
}

// ── Token alias map ──────────────────────────────────────────────────────────
const TOKEN_ALIASES: Record<string, SupportedToken> = {
  eth: "ETH",
  ether: "ETH",
  usdc: "USDC",
  "usd coin": "USDC",
  cbbtc: "cbBTC",
  "cb btc": "cbBTC",
  "coinbase btc": "cbBTC",
  btc: "cbBTC",
  bitcoin: "cbBTC",
  eurc: "EURC",
  eur: "EURC",
  "euro coin": "EURC",
  "euro stablecoin": "EURC",
};

// ── Stable pair detection ─────────────────────────────────────────────────────
const STABLE_PAIRS = new Set<string>(["USDC-EURC", "EURC-USDC"]);

function isStablePair(a: SupportedToken, b: SupportedToken): boolean {
  return STABLE_PAIRS.has(`${a}-${b}`);
}

// ── Hook keyword detection ────────────────────────────────────────────────────
const HOOK_KEYWORDS = [
  /stable\s+protection/i,
  /stable\s+hook/i,
  /peg\s+protection/i,
  /circuit\s+breaker/i,
];

function detectExplicitHook(input: string): boolean {
  return HOOK_KEYWORDS.some((re) => re.test(input));
}

// ── Swap intent verbs ─────────────────────────────────────────────────────────
const SELL_VERBS = /\b(swap|exchange|sell|convert|trade|flip|dump|turn)\b/i;
const BUY_VERB = /\b(buy|get|purchase)\b/i;

// ── Token token extraction helpers ───────────────────────────────────────────
const TOKEN_PATTERN = "eth|ether|usdc|cbbtc|eurc|btc|eur";

function resolveTokenAlias(raw: string): SupportedToken | null {
  return TOKEN_ALIASES[raw.toLowerCase()] ?? null;
}

interface DirectedExtraction {
  tokenIn: SupportedToken;
  tokenOut: SupportedToken;
  amountIn: string | null;
}

function extractSwapDirection(input: string): DirectedExtraction | null {
  const lower = input.toLowerCase();

  // Pattern A: "buy [tokenOut] with [amount?] [tokenIn]"
  const buyWithRe = new RegExp(
    `buy\\s+(\\w+)\\s+with\\s+([\\d.]+)?\\s*(${TOKEN_PATTERN})`,
    "i"
  );
  const buyWithMatch = lower.match(buyWithRe);
  if (buyWithMatch) {
    const tokenOut = resolveTokenAlias(buyWithMatch[1]);
    const tokenIn = resolveTokenAlias(buyWithMatch[3]);
    if (tokenIn && tokenOut && tokenIn !== tokenOut) {
      return { tokenIn, tokenOut, amountIn: buyWithMatch[2] ?? null };
    }
  }

  // Pattern B: "[amount?] [tokenIn] for|to|into [tokenOut]"
  const forRe = new RegExp(
    `([\\d.]+)?\\s*(${TOKEN_PATTERN})\\s+(?:for|to|into)\\s+(${TOKEN_PATTERN})`,
    "i"
  );
  const forMatch = lower.match(forRe);
  if (forMatch) {
    const tokenIn = resolveTokenAlias(forMatch[2]);
    const tokenOut = resolveTokenAlias(forMatch[3]);
    if (tokenIn && tokenOut && tokenIn !== tokenOut) {
      return { tokenIn, tokenOut, amountIn: forMatch[1] ?? null };
    }
  }

  // Pattern C: "sell/dump [amount?] [tokenIn]" — tokenOut from second token mention
  const sellRe = new RegExp(
    `(?:sell|dump)\\s+([\\d.]+)?\\s*(${TOKEN_PATTERN})`,
    "i"
  );
  const sellMatch = lower.match(sellRe);
  if (sellMatch) {
    const tokenIn = resolveTokenAlias(sellMatch[2]);
    const remaining = lower.replace(sellMatch[0], "");
    const secondRe = new RegExp(`\\b(${TOKEN_PATTERN})\\b`, "i");
    const secondMatch = remaining.match(secondRe);
    const tokenOut = secondMatch ? resolveTokenAlias(secondMatch[1]) : null;
    if (tokenIn && tokenOut && tokenIn !== tokenOut) {
      return { tokenIn, tokenOut, amountIn: sellMatch[1] ?? null };
    }
  }

  // Pattern D: Generic — first token = tokenIn, second token = tokenOut
  const allTokenRe = new RegExp(
    `\\b(${TOKEN_PATTERN})\\b`,
    "gi"
  );
  const allMatches = [...lower.matchAll(allTokenRe)];
  if (allMatches.length >= 2) {
    const tokenIn = resolveTokenAlias(allMatches[0][1]);
    const tokenOut = resolveTokenAlias(allMatches[1][1]);
    const amountRe = new RegExp(`^[^0-9]*([\\d.]+)\\s*(?:${TOKEN_PATTERN})`, "i");
    const amountMatch = lower.match(amountRe);
    if (tokenIn && tokenOut && tokenIn !== tokenOut) {
      return { tokenIn, tokenOut, amountIn: amountMatch?.[1] ?? null };
    }
  }

  return null;
}

// ── Main parser ───────────────────────────────────────────────────────────────
export function parseSwapIntent(rawInput: string): SwapIntent | null {
  const lower = rawInput.toLowerCase();

  const hasSwapVerb = SELL_VERBS.test(lower) || BUY_VERB.test(lower);
  if (!hasSwapVerb) return null;

  const extraction = extractSwapDirection(rawInput);
  if (!extraction) return null;

  const { tokenIn, tokenOut, amountIn } = extraction;
  const hookExplicit = detectExplicitHook(rawInput);
  const stable = isStablePair(tokenIn, tokenOut);

  return {
    tokenIn,
    tokenOut,
    amountIn,
    useStableHook: stable || hookExplicit,
    hookExplicitlyRequested: hookExplicit,
    confidence: amountIn ? "high" : "medium",
    rawInput,
  };
}

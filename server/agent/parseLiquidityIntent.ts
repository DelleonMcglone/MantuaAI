/**
 * parseLiquidityIntent.ts
 * Deterministic parser for natural-language add-liquidity commands.
 * Maps free-form user input to a LiquidityIntent struct including
 * automatic Stable Protection Hook selection for stablecoin pairs.
 *
 * Token universe: ETH, USDC, cbBTC, EURC
 * Stable pairs: USDC/EURC and EURC/USDC → useStableHook = true
 */

export type SupportedToken = "ETH" | "USDC" | "cbBTC" | "EURC";

export interface LiquidityIntent {
  tokenA: SupportedToken;
  tokenB: SupportedToken;
  amountA: string | null;   // raw string, null if not specified
  amountB: string | null;   // raw string, null if not specified
  useStableHook: boolean;   // true → Stable Protection Hook config
  hookExplicitlyRequested: boolean; // true → user mentioned hook by name
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
  /stable\s+protect/i,
  /peg\s+protection/i,
  /circuit\s+breaker/i,
  /use\s+the\s+hook/i,
];

function detectExplicitHook(input: string): boolean {
  return HOOK_KEYWORDS.some((re) => re.test(input));
}

// ── Token extraction ──────────────────────────────────────────────────────────
const AMOUNT_TOKEN_RE =
  /([\d.]+)\s*(eth|ether|usdc|cbbtc|cb btc|eurc|eur|btc|bitcoin)/gi;

const TOKEN_STANDALONE_RE =
  /\b(eth|ether|usdc|cbbtc|cb btc|eurc|eur|btc|bitcoin|coinbase btc|euro coin)\b/gi;

interface Extraction {
  token: SupportedToken;
  amount: string | null;
}

function extractTokens(input: string): Extraction[] {
  const found: Extraction[] = [];
  const seen = new Set<SupportedToken>();

  // Pass 1 — capture amount+token pairs
  let m: RegExpExecArray | null;
  const amountRe = new RegExp(AMOUNT_TOKEN_RE.source, "gi");
  while ((m = amountRe.exec(input)) !== null) {
    const amount = m[1];
    const raw = m[2].toLowerCase();
    const token = TOKEN_ALIASES[raw];
    if (token && !seen.has(token)) {
      found.push({ token, amount });
      seen.add(token);
    }
  }

  // Pass 2 — capture bare token names not already captured
  const standaloneRe = new RegExp(TOKEN_STANDALONE_RE.source, "gi");
  while ((m = standaloneRe.exec(input)) !== null) {
    const raw = m[1].toLowerCase();
    const token = TOKEN_ALIASES[raw];
    if (token && !seen.has(token)) {
      found.push({ token, amount: null });
      seen.add(token);
    }
  }

  return found;
}

// ── Main parser ───────────────────────────────────────────────────────────────
export function parseLiquidityIntent(rawInput: string): LiquidityIntent | null {
  const lower = rawInput.toLowerCase();

  // Must contain a liquidity intent verb
  const INTENT_VERBS =
    /\b(add|provide|deposit|supply|lp|stake|put|open|create|drop|earn fees|become)\b/i;
  if (!INTENT_VERBS.test(lower)) return null;

  const extractions = extractTokens(rawInput);
  if (extractions.length < 2) return null;

  const [first, second] = extractions;
  const hookExplicit = detectExplicitHook(rawInput);
  const stable = isStablePair(first.token, second.token);

  return {
    tokenA: first.token,
    tokenB: second.token,
    amountA: first.amount,
    amountB: second.amount,
    useStableHook: stable || hookExplicit,
    hookExplicitlyRequested: hookExplicit,
    confidence:
      first.amount && second.amount
        ? "high"
        : extractions.length === 2
        ? "medium"
        : "low",
    rawInput,
  };
}

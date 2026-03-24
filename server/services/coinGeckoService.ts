/**
 * coinGeckoService.ts
 * CoinGecko Demo API wrapper for Mantua.AI price and market data.
 * Covers ETH, USDC, cbBTC, EURC — the 4 tokens on Mantua Base Sepolia.
 *
 * All data is mainnet pricing (CoinGecko does not index testnets).
 * On-chain state (balances, tx history) uses viem — not this service.
 *
 * Rate limit: 30 calls/min on Demo plan.
 * Responses are cached for 60 seconds to stay within limits.
 */

// ── Token registry ────────────────────────────────────────────────────────────
export const COINGECKO_IDS = {
  ETH:   "ethereum",
  USDC:  "usd-coin",
  cbBTC: "coinbase-wrapped-btc",
  EURC:  "euro-coin",
} as const;

export type MantuaToken = keyof typeof COINGECKO_IDS;

const ALL_IDS = Object.values(COINGECKO_IDS).join(",");
const BASE_URL = "https://api.coingecko.com/api/v3";

// ── Simple in-memory cache (60 second TTL) ────────────────────────────────────
const cache = new Map<string, { data: unknown; expiresAt: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCached(key: string, data: unknown, ttlSeconds = 60): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function cgFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  const apiKey = process.env.COINGECKO_API_KEY;
  if (apiKey) url.searchParams.set("x_cg_demo_api_key", apiKey);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const cacheKey = url.toString();
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (res.status === 429) throw new Error("CoinGecko rate limit hit — retry in 60 seconds");
  if (!res.ok) throw new Error(`CoinGecko error: HTTP ${res.status}`);

  const data = (await res.json()) as T;
  setCached(cacheKey, data);
  return data;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface TokenPrice {
  token: MantuaToken;
  usd: number;
  usd_24h_change: number;
  usd_market_cap: number;
  usd_24h_vol: number;
}

export interface PriceHistory {
  token: MantuaToken;
  prices: Array<{ timestamp: number; price: number }>;
  days: number;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get current USD price for one token.
 * Example: getTokenPrice("ETH") → { token: "ETH", usd: 3241.50, ... }
 */
export async function getTokenPrice(token: MantuaToken): Promise<TokenPrice> {
  const id = COINGECKO_IDS[token];
  const data = await cgFetch<Record<string, Record<string, number>>>(
    "/simple/price",
    {
      ids: id,
      vs_currencies: "usd",
      include_market_cap: "true",
      include_24hr_vol: "true",
      include_24hr_change: "true",
    }
  );

  const raw = data[id];
  if (!raw) throw new Error(`No CoinGecko data found for ${token}`);

  return {
    token,
    usd:            raw.usd            ?? 0,
    usd_24h_change: raw.usd_24h_change ?? 0,
    usd_market_cap: raw.usd_market_cap ?? 0,
    usd_24h_vol:    raw.usd_24h_vol    ?? 0,
  };
}

/**
 * Get current USD prices for ALL 4 Mantua tokens in one API call.
 * Use this instead of calling getTokenPrice() 4 times.
 */
export async function getAllTokenPrices(): Promise<TokenPrice[]> {
  const data = await cgFetch<Record<string, Record<string, number>>>(
    "/simple/price",
    {
      ids: ALL_IDS,
      vs_currencies: "usd",
      include_market_cap: "true",
      include_24hr_vol: "true",
      include_24hr_change: "true",
    }
  );

  return (Object.entries(COINGECKO_IDS) as [MantuaToken, string][]).map(
    ([token, id]) => {
      const raw = data[id] ?? {};
      return {
        token,
        usd:            raw.usd            ?? 0,
        usd_24h_change: raw.usd_24h_change ?? 0,
        usd_market_cap: raw.usd_market_cap ?? 0,
        usd_24h_vol:    raw.usd_24h_vol    ?? 0,
      };
    }
  );
}

/**
 * Get historical price data for a token.
 * @param days - 1, 7, 14, 30, 90 (auto-granularity: hourly ≤90d, daily >90d)
 */
export async function getTokenPriceHistory(
  token: MantuaToken,
  days: 1 | 7 | 14 | 30 | 90 = 7
): Promise<PriceHistory> {
  const id = COINGECKO_IDS[token];
  const data = await cgFetch<{ prices: [number, number][] }>(
    `/coins/${id}/market_chart`,
    { vs_currency: "usd", days: String(days) }
  );

  return {
    token,
    days,
    prices: data.prices.map(([timestamp, price]) => ({ timestamp, price })),
  };
}

/**
 * Calculate USD value of a token amount.
 * Example: getTokenValueUSD("ETH", 0.5) → "ETH 0.5 = $1,620.75 USD"
 */
export async function getTokenValueUSD(
  token: MantuaToken,
  amount: number
): Promise<{ token: MantuaToken; amount: number; usdValue: number; formatted: string }> {
  const price = await getTokenPrice(token);
  const usdValue = price.usd * amount;
  return {
    token,
    amount,
    usdValue,
    formatted: `${amount} ${token} = $${usdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`,
  };
}

/**
 * Format a TokenPrice into a human-readable string for chat responses.
 */
export function formatTokenPrice(p: TokenPrice): string {
  const change = p.usd_24h_change;
  const sign   = change >= 0 ? "+" : "";
  const arrow  = change >= 0 ? "▲" : "▼";
  return (
    `**${p.token}** $${p.usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD ` +
    `${arrow} ${sign}${change.toFixed(2)}% (24h)`
  );
}

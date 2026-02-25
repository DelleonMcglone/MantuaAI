/**
 * CoinGecko public API client for real token price/volume data.
 * No API key required for basic endpoints.
 */

const BASE = 'https://api.coingecko.com/api/v3';

export interface OHLCPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const ohlcCache = new Map<string, { data: OHLCPoint[]; ts: number }>();
const priceCache = new Map<string, { price: number; ts: number }>();
const CACHE_MS = 60_000;

export async function getTokenOHLC(
  coingeckoId: string,
  days: 1 | 7 | 30
): Promise<OHLCPoint[]> {
  const key = `${coingeckoId}:${days}`;
  const cached = ohlcCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_MS) return cached.data;

  const res = await fetch(
    `${BASE}/coins/${coingeckoId}/ohlc?vs_currency=usd&days=${days}`
  );
  if (!res.ok) throw new Error(`CoinGecko OHLC failed: ${res.status}`);
  const raw: number[][] = await res.json();
  const data: OHLCPoint[] = raw.map(([time, open, high, low, close]) => ({
    time: Math.floor(time / 1000),
    open, high, low, close,
  }));
  ohlcCache.set(key, { data, ts: Date.now() });
  return data;
}

export async function getTokenPrice(coingeckoId: string): Promise<number> {
  const cached = priceCache.get(coingeckoId);
  if (cached && Date.now() - cached.ts < CACHE_MS) return cached.price;

  const res = await fetch(
    `${BASE}/simple/price?ids=${coingeckoId}&vs_currencies=usd&include_24hr_vol=true`
  );
  if (!res.ok) throw new Error(`CoinGecko price failed: ${res.status}`);
  const data = await res.json();
  const price = data[coingeckoId]?.usd ?? 0;
  priceCache.set(coingeckoId, { price, ts: Date.now() });
  return price;
}

export async function getAllPrices(
  ids: string[]
): Promise<Record<string, number>> {
  const joined = ids.join(',');
  const res = await fetch(
    `${BASE}/simple/price?ids=${joined}&vs_currencies=usd`
  );
  if (!res.ok) throw new Error(`CoinGecko prices failed: ${res.status}`);
  const data = await res.json();
  return Object.fromEntries(ids.map(id => [id, data[id]?.usd ?? 0]));
}

/** Returns the primary token to chart for a given pool pair */
export function getPoolChartToken(token1: string, token2: string): string {
  // Prefer non-stable, non-USDC tokens for price chart
  if (token1 === 'ETH' || token1 === 'cbBTC') return token1;
  if (token2 === 'ETH' || token2 === 'cbBTC') return token2;
  return token1;
}

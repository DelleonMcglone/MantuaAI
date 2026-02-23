/**
 * useLivePriceUSD
 * Fetches a single token's USD price from CoinGecko's /simple/price endpoint.
 * Module-level 60-second cache prevents hammering the API on every render.
 * Stablecoins return 1.00 synchronously without any API call.
 */

import { useState, useEffect, useRef } from 'react';
import { COINGECKO_IDS, PRICE_CACHE_TTL_MS } from '../config/tokenMetadata';

// ── Types ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  price: number;
  fetchedAt: number;
}

export interface UseLivePriceUSDReturn {
  price: number | null;
  isLoading: boolean;
}

// ── Module-level cache shared across all hook instances ────────────────────

export const priceCache = new Map<string, CacheEntry>();

// ── Stablecoins — always $1.00, no API call needed ─────────────────────────

const STABLECOINS = new Set([
  'USDC', 'USDT', 'USDS', 'USDeC',
  'mUSDC', 'mUSDT', 'mUSDE', 'mUSDS',
]);

// ── Fetch helper ──────────────────────────────────────────────────────────

async function fetchCoinGeckoPrice(coingeckoId: string): Promise<number | null> {
  const cached = priceCache.get(coingeckoId);
  if (cached && Date.now() - cached.fetchedAt < PRICE_CACHE_TTL_MS) {
    return cached.price;
  }

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json() as Record<string, { usd: number }>;
    const price = data[coingeckoId]?.usd ?? null;
    if (price !== null) {
      priceCache.set(coingeckoId, { price, fetchedAt: Date.now() });
    }
    return price;
  } catch {
    return null;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useLivePriceUSD(symbol: string): UseLivePriceUSDReturn {
  const [price, setPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!symbol) return;

    // Stablecoins never need an API call
    if (STABLECOINS.has(symbol)) {
      setPrice(1.00);
      setIsLoading(false);
      return;
    }

    const coingeckoId = COINGECKO_IDS[symbol];
    if (!coingeckoId) {
      // Unknown token — no price available
      setPrice(null);
      setIsLoading(false);
      return;
    }

    // Check cache first (avoid flicker if still fresh)
    const cached = priceCache.get(coingeckoId);
    if (cached && Date.now() - cached.fetchedAt < PRICE_CACHE_TTL_MS) {
      setPrice(cached.price);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetchCoinGeckoPrice(coingeckoId).then((p) => {
      if (controller.signal.aborted) return;
      setPrice(p);
      setIsLoading(false);
    });

    return () => {
      controller.abort();
    };
  }, [symbol]);

  return { price, isLoading };
}

/**
 * Fetch prices for two tokens in parallel. Returns both prices and a derived
 * exchange rate: `rate = priceA / priceB`.
 */
export function useLivePairRate(symbolA: string, symbolB: string) {
  const a = useLivePriceUSD(symbolA);
  const b = useLivePriceUSD(symbolB);

  const rate: number | null =
    a.price !== null && b.price !== null && b.price !== 0
      ? a.price / b.price
      : null;

  return {
    priceA: a.price,
    priceB: b.price,
    rate,
    isLoading: a.isLoading || b.isLoading,
  };
}

/**
 * Synchronous price lookup from cache (best-effort, no network call).
 * Returns null if not cached.
 */
export function getCachedPrice(symbol: string): number | null {
  if (STABLECOINS.has(symbol)) return 1.00;
  const coingeckoId = COINGECKO_IDS[symbol];
  if (!coingeckoId) return null;
  const cached = priceCache.get(coingeckoId);
  if (cached && Date.now() - cached.fetchedAt < PRICE_CACHE_TTL_MS) {
    return cached.price;
  }
  return null;
}

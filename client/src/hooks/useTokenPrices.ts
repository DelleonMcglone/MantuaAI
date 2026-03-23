/**
 * useTokenPrices.ts
 * React hook that fetches all 4 token prices from /api/prices.
 * Auto-refreshes every 60 seconds (respecting CoinGecko's server-side cache TTL).
 */

import { useState, useEffect } from "react";

export interface TokenPrice {
  token: string;
  usd: number;
  usd_24h_change: number;
  usd_market_cap: number;
  usd_24h_vol: number;
}

export function useTokenPrices() {
  const [prices, setPrices] = useState<Record<string, TokenPrice>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPrices() {
      try {
        const res = await fetch("/api/prices");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: TokenPrice[] = await res.json();
        if (!cancelled) {
          setPrices(Object.fromEntries(data.map((p) => [p.token, p])));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load prices");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPrices();
    const interval = setInterval(fetchPrices, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { prices, loading, error };
}

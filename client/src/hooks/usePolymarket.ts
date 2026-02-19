/**
 * usePolymarket.ts
 * Fetches live market data from Polymarket's Gamma API.
 * Gamma API is public and requires no authentication.
 *
 * Gamma API base: https://gamma-api.polymarket.com
 */

import { useState, useEffect, useCallback } from 'react';

export interface PolymarketMarket {
  id:        string;
  question:  string;
  category:  string;
  yesPrice:  number;   // 0.0 – 1.0 (implied probability)
  noPrice:   number;
  volume24h: number;   // USD
  liquidity: number;   // USD
  endDate:   string;   // ISO date string
  active:    boolean;
  source:    'polymarket';
}

const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const CACHE_TTL  = 60_000; // 60 seconds

let cache: { data: PolymarketMarket[]; timestamp: number } | null = null;

export function usePolymarket(category?: string) {
  const [markets,   setMarkets]  = useState<PolymarketMarket[]>([]);
  const [isLoading, setLoading]  = useState(true);
  const [error,     setError]    = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    // Return cached data if still fresh
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      const filtered = category
        ? cache.data.filter(m => m.category === category)
        : cache.data;
      setMarkets(filtered);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(
        `${GAMMA_BASE}/markets?active=true&closed=false&limit=50`,
        { headers: { Accept: 'application/json' } }
      );

      if (!res.ok) throw new Error(`Gamma API error: ${res.status}`);
      const raw = await res.json();

      const normalized: PolymarketMarket[] = (Array.isArray(raw) ? raw : []).map((m: any) => {
        const yesP = parseFloat(m.bestAsk ?? m.lastTradePrice ?? '0.5');
        return {
          id:        m.conditionId ?? m.id ?? String(Math.random()),
          question:  m.question ?? '',
          category:  m.category ?? 'other',
          yesPrice:  isNaN(yesP) ? 0.5 : yesP,
          noPrice:   isNaN(yesP) ? 0.5 : 1 - yesP,
          volume24h: parseFloat(m.volume24hr ?? '0') || 0,
          liquidity: parseFloat(m.liquidity  ?? '0') || 0,
          endDate:   m.endDate ?? m.endDateIso ?? '',
          active:    m.active ?? true,
          source:    'polymarket',
        };
      });

      cache = { data: normalized, timestamp: Date.now() };
      const filtered = category ? normalized.filter(m => m.category === category) : normalized;
      setMarkets(filtered);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      // On error, return stale cache if available
      if (cache) {
        const filtered = category ? cache.data.filter(m => m.category === category) : cache.data;
        setMarkets(filtered);
      }
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return { markets, isLoading, error, refresh: fetchMarkets };
}

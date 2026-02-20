/**
 * SwapPriceChart
 *
 * Displays a price chart for a selected token pair.
 * Data source priority:
 *   1. CoinGecko free-tier API (via COINGECKO_IDS mapping)
 *   2. Realistic mock data seeded from priceService (with [Mock Data] badge)
 *
 * Responds to fromToken / toToken changes and has a 1D / 7D / 30D selector.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { COINGECKO_IDS, COINGECKO_DAYS, PRICE_CACHE_TTL_MS } from '../../config/tokenMetadata';
import { getPriceBySymbol } from '../../services/priceService';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PricePoint {
  time: string;
  price: number;
}

interface ChartState {
  data: PricePoint[];
  currentPrice: number;
  change24h: number;
  isMock: boolean;
  isLoading: boolean;
  error: string | null;
}

interface CacheEntry {
  data: PricePoint[];
  timestamp: number;
}

// ─── In-memory cache keyed by "id:days" ──────────────────────────────────────

const priceCache = new Map<string, CacheEntry>();

function getCached(key: string): PricePoint[] | null {
  const entry = priceCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > PRICE_CACHE_TTL_MS) {
    priceCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: PricePoint[]) {
  priceCache.set(key, { data, timestamp: Date.now() });
}

// ─── Mock data generator ─────────────────────────────────────────────────────

function generateMockData(
  basePrice: number,
  days: number,
): PricePoint[] {
  const points: PricePoint[] = [];
  const now = Date.now();
  const interval = (days * 24 * 60 * 60 * 1000) / 30;
  let price = basePrice * (0.92 + Math.random() * 0.16);

  for (let i = 30; i >= 0; i--) {
    const ts = now - i * interval;
    price = price * (1 + (Math.random() - 0.5) * 0.04);
    const date = new Date(ts);
    const label = days <= 1
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    points.push({ time: label, price: parseFloat(price.toFixed(6)) });
  }
  return points;
}

// ─── CoinGecko fetcher ───────────────────────────────────────────────────────

async function fetchCoinGeckoPrices(id: string, days: string): Promise<number[][]> {
  const url =
    `https://api.coingecko.com/api/v3/coins/${id}/market_chart` +
    `?vs_currency=usd&days=${days}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const json = await res.json();
  return json.prices as number[][];
}

function buildPairData(
  pricesA: number[][],
  pricesB: number[][] | null,
  days: number,
): PricePoint[] {
  const minLen = pricesB ? Math.min(pricesA.length, pricesB.length) : pricesA.length;
  const stride = Math.max(1, Math.floor(minLen / 40));
  const points: PricePoint[] = [];

  for (let i = 0; i < minLen; i += stride) {
    const pA = pricesA[i][1];
    const pB = pricesB ? pricesB[i][1] : 1;
    const pairPrice = pA / pB;
    const ts = pricesA[i][0];
    const date = new Date(ts);
    const label = days <= 1
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    points.push({ time: label, price: parseFloat(pairPrice.toFixed(6)) });
  }
  return points;
}

// ─── USD stablecoins (show toToken price in USD directly) ───────────────────

const USD_STABLES = new Set(['mUSDC', 'mUSDT', 'mDAI', 'USDC', 'USDT', 'DAI', 'mFRAX', 'FRAX', 'mUSDe']);

// ─── Main component ──────────────────────────────────────────────────────────

interface Props {
  fromToken: string;
  toToken: string;
  theme: any;
  isDark?: boolean;
}

const RANGES = ['1D', '7D', '30D'] as const;
type Range = typeof RANGES[number];

export const SwapPriceChart: React.FC<Props> = ({ fromToken, toToken, theme, isDark = true }) => {
  const [range, setRange] = useState<Range>('7D');
  const [state, setState] = useState<ChartState>({
    data: [],
    currentPrice: 0,
    change24h: 0,
    isMock: false,
    isLoading: true,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const loadData = useCallback(async (from: string, to: string, r: Range) => {
    // Cancel any in-flight fetch
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setState(s => ({ ...s, isLoading: true, error: null }));

    const days = parseInt(COINGECKO_DAYS[r] || '7', 10);
    const fromId = COINGECKO_IDS[from];
    const toId   = COINGECKO_IDS[to];
    const isFromStable = USD_STABLES.has(from);
    const effectiveFromId = isFromStable ? null : fromId;
    const effectiveToId   = isFromStable ? fromId : toId;

    try {
      // Determine which token(s) to fetch
      const fetchFromId = effectiveFromId ?? effectiveToId;
      const fetchToId   = effectiveFromId ? effectiveToId : null;

      if (!fetchFromId) throw new Error('no-coingecko-id');

      const cacheKeyA = `${fetchFromId}:${r}`;
      let pricesA = getCached(cacheKeyA);
      if (!pricesA) {
        const raw = await fetchCoinGeckoPrices(fetchFromId, COINGECKO_DAYS[r]);
        pricesA = buildPairData(raw, null, days);
        setCache(cacheKeyA, pricesA);
      }

      let finalData: PricePoint[];

      if (fetchToId) {
        const cacheKeyB = `${fetchToId}:${r}`;
        let pricesB = getCached(cacheKeyB);
        if (!pricesB) {
          const rawB = await fetchCoinGeckoPrices(fetchToId, COINGECKO_DAYS[r]);
          pricesB = buildPairData(rawB, null, days);
          setCache(cacheKeyB, pricesB);
        }
        // Combine: price = priceA / priceB
        finalData = pricesA.map((pt, i) => ({
          time: pt.time,
          price: parseFloat((pt.price / (pricesB![i]?.price || 1)).toFixed(6)),
        }));
      } else {
        finalData = pricesA;
      }

      const currentPrice = finalData[finalData.length - 1]?.price ?? 0;
      const dayAgoPrice  = finalData[0]?.price ?? currentPrice;
      const change24h    = dayAgoPrice !== 0
        ? ((currentPrice - dayAgoPrice) / dayAgoPrice) * 100
        : 0;

      setState({
        data: finalData,
        currentPrice,
        change24h,
        isMock: false,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') return;

      // Fall back to mock data
      const baseFrom = getPriceBySymbol(from) || getPriceBySymbol(from.replace(/^m/, '')) || 1;
      const baseTo   = getPriceBySymbol(to)   || getPriceBySymbol(to.replace(/^m/, ''))   || 1;
      const basePrice = baseTo > 0 ? baseFrom / baseTo : baseFrom;
      const mockData  = generateMockData(basePrice, days);
      const currentPrice = mockData[mockData.length - 1]?.price ?? basePrice;
      const dayAgoPrice  = mockData[0]?.price ?? currentPrice;
      const change24h = dayAgoPrice !== 0
        ? ((currentPrice - dayAgoPrice) / dayAgoPrice) * 100
        : 0;

      setState({
        data: mockData,
        currentPrice,
        change24h,
        isMock: true,
        isLoading: false,
        error: null,
      });
    }
  }, []);

  useEffect(() => {
    loadData(fromToken, toToken, range);
    return () => { abortRef.current?.abort(); };
  }, [fromToken, toToken, range, loadData]);

  const { data, currentPrice, change24h, isMock, isLoading } = state;
  const isPositive = change24h >= 0;
  const accentColor = '#8b5cf6';
  const changeColor = isPositive ? '#10b981' : '#ef4444';

  // Format price for display
  const formatPrice = (p: number) => {
    if (p === 0) return '—';
    if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (p >= 1)    return `$${p.toFixed(4)}`;
    return `$${p.toFixed(6)}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* Header: price + change */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
            {isLoading ? (
              <div style={{ width: 120, height: 32, borderRadius: 8, background: 'rgba(148,163,184,0.15)', animation: 'shimmer 1.4s ease-in-out infinite' }} />
            ) : (
              <span style={{ color: theme.textPrimary, fontSize: 28, fontWeight: 700, fontFamily: 'SF Mono, Monaco, monospace', letterSpacing: '-0.03em' }}>
                {formatPrice(currentPrice)}
              </span>
            )}
            {!isLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${changeColor}18`, padding: '4px 8px', borderRadius: 6 }}>
                <span style={{ color: changeColor, fontSize: 13, fontWeight: 700 }}>
                  {isPositive ? '+' : ''}{change24h.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          <div style={{ color: theme.textSecondary, fontSize: 12 }}>
            {fromToken} / {toToken}
            {isMock && (
              <span style={{ marginLeft: 8, background: 'rgba(107,114,128,0.2)', color: '#9ca3af', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4 }}>
                Mock Data
              </span>
            )}
          </div>
        </div>

        {/* Time range selector */}
        <div style={{ display: 'flex', gap: 4, background: theme.bgSecondary, padding: 4, borderRadius: 10 }}>
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                background: range === r ? theme.bgCard : 'transparent',
                color: range === r ? theme.textPrimary : theme.textSecondary,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: range === r ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 180 }}>
        {isLoading ? (
          <div style={{ width: '100%', height: '100%', borderRadius: 12, background: 'rgba(148,163,184,0.08)', animation: 'shimmer 1.4s ease-in-out infinite', minHeight: 180 }} />
        ) : data.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 180, color: theme.textSecondary, fontSize: 14 }}>
            Price data unavailable for {fromToken}/{toToken}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={accentColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={accentColor} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} strokeOpacity={0.4} />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: theme.textSecondary, fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: theme.textSecondary, fontSize: 10 }}
                tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(4)}`}
                width={60}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{ backgroundColor: theme.bgCard, borderColor: theme.border, borderRadius: 8, fontSize: 12, color: theme.textPrimary }}
                formatter={(value: number) => [formatPrice(value), `${fromToken}/${toToken}`]}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={accentColor}
                strokeWidth={2}
                fill="url(#priceGrad)"
                dot={false}
                activeDot={{ r: 4, fill: accentColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <style>{`@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
};

export default SwapPriceChart;

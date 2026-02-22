import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { COINGECKO_IDS, PRICE_CACHE_TTL_MS } from '../../config/tokenMetadata';

interface PoolActivityChartProps {
  theme: any;
  isDark: boolean;
  tokenA?: string;
  tokenB?: string;
}

// ── Module-level cache (shared with SwapPriceChart) ────────────────────────

interface CacheEntry { data: [number, number][]; fetchedAt: number; }
const chartCache = new Map<string, CacheEntry>();

const STABLECOINS = new Set([
  'USDC','USDT','USDE','USDS','mUSDC','mUSDT','mUSDE','mUSDS',
]);

async function fetchChartData(id: string, days: number): Promise<[number, number][] | null> {
  const key = `${id}:${days}`;
  const cached = chartCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < PRICE_CACHE_TTL_MS) return cached.data;
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const json = await r.json();
    const data: [number, number][] = json.prices ?? [];
    chartCache.set(key, { data, fetchedAt: Date.now() });
    return data;
  } catch {
    return null;
  }
}

// ── Deterministic fallback ──────────────────────────────────────────────────

function seedRandom(str: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return () => { h ^= h << 13; h ^= h >> 17; h ^= h << 5; h = h >>> 0; return (h % 1000) / 1000; };
}

const RANGE_DAYS: Record<string, number> = { '1D': 1, '7D': 7, '30D': 30 };

// ── Component ──────────────────────────────────────────────────────────────

const PoolActivityChart: React.FC<PoolActivityChartProps> = ({ theme, isDark, tokenA, tokenB }) => {
  const [range, setRange] = useState<'1D' | '7D' | '30D'>('7D');
  const [chartData, setChartData] = useState<{ name: string; price: number }[]>([]);
  const [isMock, setIsMock] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const pairKey = `${tokenA ?? 'ETH'}/${tokenB ?? 'mUSDC'}`;

  // Fallback mock data seeded by pair
  const mockData = useMemo(() => {
    const rand = seedRandom(pairKey + range);
    const pts = range === '1D' ? 24 : range === '7D' ? 28 : 30;
    return Array.from({ length: pts }, (_, i) => ({
      name: `${i + 1}`,
      price: 1.0 + (rand() - 0.5) * 0.02,
    }));
  }, [pairKey, range]);

  useEffect(() => {
    let cancelled = false;
    const days = RANGE_DAYS[range];

    const symA = tokenA ?? 'ETH';
    const symB = tokenB ?? 'mUSDC';
    const idA  = STABLECOINS.has(symA) ? null : (COINGECKO_IDS[symA] ?? null);
    const idB  = STABLECOINS.has(symB) ? null : (COINGECKO_IDS[symB] ?? null);

    if (!idA && !idB) {
      // Both unknown/stablecoins — use mock flat data
      setChartData(mockData);
      setIsMock(true);
      return;
    }

    setIsLoading(true);

    Promise.all([
      idA ? fetchChartData(idA, days) : Promise.resolve(null),
      idB ? fetchChartData(idB, days) : Promise.resolve(null),
    ]).then(([pricesA, pricesB]) => {
      if (cancelled) return;

      const refA = pricesA ?? null;
      const refB = pricesB ?? null;

      if (!refA && !refB) {
        setChartData(mockData);
        setIsMock(true);
        setIsLoading(false);
        return;
      }

      // Use available data
      const base = refA ?? refB!;
      const pts = base.map(([ts, pA]: [number, number], i: number) => {
        const pB = refB ? (refB[i]?.[1] ?? refB[refB.length - 1]?.[1] ?? 1) : 1.0;
        const realA = refA ? pA : 1.0;
        const price = pB !== 0 ? realA / pB : 1.0;
        const d = new Date(ts);
        const name = days === 1
          ? `${d.getHours()}:00`
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { name, price };
      });

      // Subsample to max 60 points for display
      const step = Math.max(1, Math.floor(pts.length / 60));
      const sampled = pts.filter((_, i) => i % step === 0);

      setChartData(sampled);
      setIsMock(false);
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [pairKey, range]);

  const accent = theme.accent ?? '#8b5cf6';
  const gradId = `pool-chart-grad-${pairKey.replace(/\W/g, '')}`;

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '200px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
          {pairKey} Price
          {isMock && (
            <span style={{ background: 'rgba(107,114,128,0.2)', color: '#9ca3af', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3 }}>
              Mock Data
            </span>
          )}
          <span style={{ background: 'rgba(107,114,128,0.2)', color: '#9ca3af', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3 }}>
            Testnet
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['1D', '7D', '30D'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: range === r ? accent : 'transparent',
                color: range === r ? '#fff' : theme.textMuted,
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{
          width: '100%',
          height: '85%',
          borderRadius: 8,
          background: 'rgba(148,163,184,0.08)',
          animation: 'poolChartShimmer 1.4s ease-in-out infinite',
          minHeight: 140,
        }} />
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.25} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} strokeOpacity={0.4} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme.textSecondary, fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis
              axisLine={false} tickLine={false}
              tick={{ fill: theme.textSecondary, fontSize: 9 }}
              tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : v < 0.01 ? v.toExponential(1) : `$${v.toFixed(v >= 10 ? 2 : 4)}`}
              width={55}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{ backgroundColor: theme.bgCard, borderColor: theme.border, borderRadius: 8, fontSize: 12, color: theme.textPrimary }}
              formatter={(v: number) => [`${v >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v.toFixed(4)}`, `${pairKey} Price`]}
            />
            <Area type="monotone" dataKey="price" stroke={accent} strokeWidth={1.5} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 3, fill: accent }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
      <style>{`@keyframes poolChartShimmer { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
};

export default PoolActivityChart;

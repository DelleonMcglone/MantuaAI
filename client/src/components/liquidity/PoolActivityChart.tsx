import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface PoolActivityChartProps {
  theme: any;
  isDark: boolean;
  tokenA?: string;
  tokenB?: string;
}

/**
 * Generates deterministic mock volume data seeded by the token pair.
 * Dynamic Fee series has been removed per Issue 3/5.
 */
function seedRandom(str: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return () => {
    h ^= h << 13;
    h ^= h >> 17;
    h ^= h << 5;
    h = h >>> 0;
    return (h % 1000) / 1000;
  };
}

const LABELS = [
  'Dec 12', 'Dec 14', 'Dec 16', 'Dec 18', 'Dec 20', 'Dec 22',
  'Dec 24', 'Dec 26', 'Dec 28', 'Jan 1', 'Jan 3', 'Jan 5', 'Jan 7', 'Jan 14',
];

const PoolActivityChart: React.FC<PoolActivityChartProps> = ({ theme, isDark, tokenA, tokenB }) => {
  const pairKey = `${tokenA ?? 'ETH'}/${tokenB ?? 'mUSDC'}`;

  const data = useMemo(() => {
    const rand = seedRandom(pairKey);
    const baseVolume = 80_000 + rand() * 200_000;
    return LABELS.map(name => ({
      name,
      volume: Math.round(baseVolume * (0.6 + rand() * 0.8)),
    }));
  }, [pairKey]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '200px' }}>
      <div style={{ marginBottom: 6, fontSize: 11, color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
        {tokenA && tokenB ? `${pairKey} Volume` : 'Volume'}
        <span style={{ background: 'rgba(107,114,128,0.2)', color: '#9ca3af', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3 }}>Testnet</span>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} strokeOpacity={0.5} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: theme.textSecondary, fontSize: 10 }}
            interval={2}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: theme.textSecondary, fontSize: 10 }}
            tickFormatter={(value) => `$${value / 1000}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: theme.bgCard,
              borderColor: theme.border,
              borderRadius: '8px',
              fontSize: '12px',
              color: theme.textPrimary,
            }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Volume']}
          />
          <Bar dataKey="volume" fill="#f97316" radius={[4, 4, 0, 0]} barSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PoolActivityChart;

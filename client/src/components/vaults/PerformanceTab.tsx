/**
 * PerformanceTab.tsx
 * Historical APY and TVL chart for each vault (mock data).
 * Shows 30-day sparklines + current stats per vault.
 */

import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatApy }                from '../../config/vaults.ts';
import type { VaultData }           from '../../hooks/useVaults.ts';

// Generate deterministic mock historical APY data points
function generateApyHistory(baseApyBps: number, days = 30): number[] {
  const seed = baseApyBps;
  return Array.from({ length: days }, (_, i) => {
    const noise = Math.sin(i * seed * 0.01 + seed) * 50;
    return Math.max(10, baseApyBps + noise);
  });
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 120;
  const H = 32;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`)
    .join(' ');

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
    </svg>
  );
}

interface Props {
  vaults: VaultData[];
}

export function PerformanceTab({ vaults }: Props) {
  return (
    <div className="p-6">
      <p className="text-xs text-gray-600 mb-6">
        30-day APY history (simulated). Updates as yield accrues on-chain.
      </p>

      <div className="flex flex-col gap-4">
        {vaults.map(vault => {
          const history  = generateApyHistory(vault.liveApyBps);
          const first    = history[0];
          const last     = history[history.length - 1];
          const delta    = ((last - first) / first) * 100;
          const isUp     = delta >= 0;
          const tvlNum   = parseFloat(vault.totalAssetsFormatted);
          const tvlStr   = tvlNum >= 1_000_000
            ? `$${(tvlNum / 1_000_000).toFixed(2)}M`
            : tvlNum >= 1_000
            ? `$${(tvlNum / 1_000).toFixed(0)}K`
            : '—';

          return (
            <div key={vault.id}
                 className="p-4 bg-gray-900 border border-gray-800 rounded-2xl">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-white">{vault.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{vault.pair}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-emerald-400">
                    {formatApy(vault.liveApyBps)}
                  </p>
                  <div className={`flex items-center gap-1 text-xs justify-end mt-0.5 ${
                    isUp ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {isUp
                      ? <TrendingUp className="w-3 h-3" />
                      : <TrendingDown className="w-3 h-3" />}
                    {isUp ? '+' : ''}{delta.toFixed(1)}% 30d
                  </div>
                </div>
              </div>

              {/* Sparkline */}
              <div className="mb-4">
                <Sparkline
                  data={history}
                  color={isUp ? '#34d399' : '#f87171'}
                />
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-gray-800 rounded-lg text-center">
                  <p className="text-gray-500 mb-0.5">30d High</p>
                  <p className="font-semibold text-white">
                    {(Math.max(...history) / 100).toFixed(1)}%
                  </p>
                </div>
                <div className="p-2 bg-gray-800 rounded-lg text-center">
                  <p className="text-gray-500 mb-0.5">30d Low</p>
                  <p className="font-semibold text-white">
                    {(Math.min(...history) / 100).toFixed(1)}%
                  </p>
                </div>
                <div className="p-2 bg-gray-800 rounded-lg text-center">
                  <p className="text-gray-500 mb-0.5">TVL</p>
                  <p className="font-semibold text-white">{tvlStr}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

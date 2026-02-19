/**
 * VaultsView.tsx
 * Full-page vaults terminal.
 * Matches design language of PredictionsView exactly.
 * Tabs: Vaults | My Deposits | Performance
 */

import { useState }          from 'react';
import { Layers, Wallet, TrendingUp } from 'lucide-react';
import { VaultsGrid }        from './VaultsGrid';
import { MyDepositsTab }     from './MyDepositsTab';
import { PerformanceTab }    from './PerformanceTab';
import { useVaults }         from '../../hooks/useVaults.ts';
import { formatApy, avgApyBps } from '../../config/vaults.ts';

type Tab = 'vaults' | 'deposits' | 'performance';

const TABS = [
  { id: 'vaults'      as Tab, label: 'Vaults',      icon: Layers    },
  { id: 'deposits'    as Tab, label: 'My Deposits',  icon: Wallet    },
  { id: 'performance' as Tab, label: 'Performance',  icon: TrendingUp },
];

export function VaultsView() {
  const [activeTab, setActiveTab] = useState<Tab>('vaults');
  const { vaults, isLoading } = useVaults();

  // Aggregate stats
  const totalTvl    = vaults.reduce((s, v) => s + parseFloat(v.totalAssetsFormatted), 0);
  const totalTvlStr = totalTvl >= 1_000_000
    ? `$${(totalTvl / 1_000_000).toFixed(2)}M`
    : totalTvl >= 1_000
    ? `$${(totalTvl / 1_000).toFixed(0)}K`
    : '—';

  const myTotal = vaults.reduce((s, v) => s + parseFloat(v.userAssetsFormatted), 0);
  const myTotalStr = myTotal > 0
    ? myTotal.toFixed(4)
    : '—';

  const depositsTab = TABS.find(t => t.id === 'deposits')!;
  const myBadge     = vaults.filter(v => v.userShares > 0n).length;

  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-950 overflow-hidden">

      {/* ── TOP HEADER ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-800">

        {/* Title row */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-white">Vaults</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              ERC-4626 yield vaults — deposit LP tokens, earn passive yield
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5
                          bg-emerald-900/30 border border-emerald-700/50 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400">Live</span>
          </div>
        </div>

        {/* ── STATS ROW ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
              Total TVL
            </p>
            <p className="text-2xl font-bold text-white">{totalTvlStr}</p>
            <p className="text-xs text-gray-500 mt-0.5">across {vaults.length} vaults</p>
          </div>
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
              Avg APY
            </p>
            <p className="text-2xl font-bold text-emerald-400">
              {formatApy(avgApyBps())}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">across all strategies</p>
          </div>
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
              My Deposits
            </p>
            <p className="text-2xl font-bold text-white">{myTotalStr}</p>
            <p className="text-xs text-gray-500 mt-0.5">LP tokens</p>
          </div>
        </div>

        {/* ── TAB BAR ──────────────────────────────────────────────── */}
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm
                         font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gray-800 text-white border border-gray-700'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'deposits' && myBadge > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 bg-purple-600 text-white
                                 text-xs rounded-full font-bold leading-none">
                  {myBadge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT — scrollable ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'vaults'      && (
          <VaultsGrid vaults={vaults} isLoading={isLoading} />
        )}
        {activeTab === 'deposits'    && (
          <MyDepositsTab vaults={vaults} />
        )}
        {activeTab === 'performance' && (
          <PerformanceTab vaults={vaults} />
        )}
      </div>
    </div>
  );
}

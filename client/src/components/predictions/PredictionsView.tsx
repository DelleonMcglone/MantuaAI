/**
 * PredictionsView.tsx
 * Full-page prediction market terminal.
 * Matches design language of LiquidityPools.tsx exactly.
 * Tabs: Markets | Arbitrage | My Positions
 */

import { useState } from 'react';
import { TrendingUp, Zap, Briefcase } from 'lucide-react';
import { MarketsTab }        from './MarketsTab';
import { ArbitrageTab }      from './ArbitrageTab';
import { PositionsTab }      from './PositionsTab';
import { usePolymarket }     from '../../hooks/usePolymarket';
import { useMantualMarkets } from '../../hooks/useMantualMarkets';
import { useArbitrage }      from '../../hooks/useArbitrage';
import { getKalshiMarkets }  from '../../config/kalshiMock';

type Tab = 'markets' | 'arbitrage' | 'positions';

export function PredictionsView() {
  const [activeTab, setActiveTab] = useState<Tab>('markets');

  const { markets: polyMarkets,   isLoading: polyLoading   } = usePolymarket();
  const { markets: mantuaMarkets, isLoading: mantuaLoading } = useMantualMarkets();
  const kalshiMarkets    = getKalshiMarkets();
  const arbOpportunities = useArbitrage(mantuaMarkets, polyMarkets, kalshiMarkets);

  const allMarkets  = [...mantuaMarkets, ...polyMarkets, ...kalshiMarkets];
  const totalVolume = allMarkets.reduce((s, m) => s + (m.volume24h ?? 0), 0);
  const bestSpread  = arbOpportunities[0]?.spreadPct ?? 0;

  const TABS = [
    { id: 'markets'   as Tab, label: 'Markets',      icon: TrendingUp, badge: null },
    { id: 'arbitrage' as Tab, label: 'Arbitrage',    icon: Zap,
      badge: arbOpportunities.length > 0 ? arbOpportunities.length : null },
    { id: 'positions' as Tab, label: 'My Positions', icon: Briefcase,  badge: null },
  ];

  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-950 overflow-hidden">

      {/* ── TOP HEADER ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-800">

        {/* Title row */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-white">Prediction Markets</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Unified view across Mantua, Polymarket &amp; Kalshi
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5
                          bg-emerald-900/30 border border-emerald-700/50 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400">Live</span>
          </div>
        </div>

        {/* ── STATS ROW ────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
              Total Markets
            </p>
            <p className="text-2xl font-bold text-white">{allMarkets.length}</p>
            <p className="text-xs text-emerald-400 mt-0.5">
              {mantuaMarkets.length} on Mantua
            </p>
          </div>
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
              Volume (24h)
            </p>
            <p className="text-2xl font-bold text-white">
              ${totalVolume >= 1_000_000
                ? `${(totalVolume / 1_000_000).toFixed(1)}M`
                : `${(totalVolume / 1_000).toFixed(0)}K`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Across all venues</p>
          </div>
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
              Best Arb Spread
            </p>
            <p className={`text-2xl font-bold ${bestSpread > 0 ? 'text-emerald-400' : 'text-white'}`}>
              {bestSpread > 0 ? `+${bestSpread.toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {arbOpportunities.length} opportunities
            </p>
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
              {tab.badge !== null && (
                <span className="ml-0.5 px-1.5 py-0.5 bg-purple-600 text-white
                                 text-xs rounded-full font-bold leading-none">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT — scrollable ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'markets' && (
          <MarketsTab
            mantuaMarkets={mantuaMarkets}
            polyMarkets={polyMarkets}
            kalshiMarkets={kalshiMarkets}
            isLoading={polyLoading || mantuaLoading}
          />
        )}
        {activeTab === 'arbitrage' && (
          <ArbitrageTab opportunities={arbOpportunities} />
        )}
        {activeTab === 'positions' && (
          <PositionsTab mantuaMarkets={mantuaMarkets} />
        )}
      </div>
    </div>
  );
}

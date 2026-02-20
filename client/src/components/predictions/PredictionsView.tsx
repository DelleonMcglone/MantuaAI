/**
 * PredictionsView.tsx
 * Full-page prediction market terminal.
 * Tabs: Markets | Arbitrage | My Positions
 * Theme-aware via optional `theme`/`isDark` props.
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

interface Props {
  theme?:  any;
  isDark?: boolean;
}

export function PredictionsView({ theme, isDark }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('markets');

  const { markets: polyMarkets,   isLoading: polyLoading   } = usePolymarket();
  const { markets: mantuaMarkets, isLoading: mantuaLoading } = useMantualMarkets();
  const kalshiMarkets    = getKalshiMarkets();
  const arbOpportunities = useArbitrage(mantuaMarkets, polyMarkets, kalshiMarkets);

  const allMarkets  = [...mantuaMarkets, ...polyMarkets, ...kalshiMarkets];
  const totalVolume = allMarkets.reduce((s, m) => s + (m.volume24h ?? 0), 0);
  const bestSpread  = arbOpportunities[0]?.spreadPct ?? 0;

  const bgPrimary   = theme?.bgPrimary     ?? '#030712';
  const bgCard      = theme?.bgCard        ?? '#111827';
  const border      = theme?.border        ?? 'rgba(55,65,81,1)';
  const textPrimary = theme?.textPrimary   ?? '#ffffff';
  const textSec     = theme?.textSecondary ?? '#9ca3af';
  const accent      = theme?.accent        ?? '#8b5cf6';

  const TABS = [
    { id: 'markets'   as Tab, label: 'Markets',      icon: TrendingUp, badge: null as number | null },
    { id: 'arbitrage' as Tab, label: 'Arbitrage',    icon: Zap,
      badge: arbOpportunities.length > 0 ? arbOpportunities.length : null },
    { id: 'positions' as Tab, label: 'My Positions', icon: Briefcase,  badge: null as number | null },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: bgPrimary, overflow: 'hidden' }}>

      {/* ── TOP HEADER ─────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: '24px 24px 16px', borderBottom: `1px solid ${border}` }}>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: textPrimary, margin: '0 0 2px' }}>Prediction Markets</h1>
            <p style={{ fontSize: 14, color: textSec, margin: 0 }}>
              Unified view across Mantua, Polymarket &amp; Kalshi
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20 }}>
            <span className="animate-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: '#34d399' }}>Live</span>
          </div>
        </div>

        {/* ── STATS ROW ────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
          <div style={{ padding: 16, background: bgCard, border: `1px solid ${border}`, borderRadius: 12 }}>
            <p style={{ fontSize: 11, color: textSec, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Total Markets</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: textPrimary, margin: 0 }}>{allMarkets.length}</p>
            <p style={{ fontSize: 11, color: '#34d399', marginTop: 2 }}>{mantuaMarkets.length} on Mantua</p>
          </div>
          <div style={{ padding: 16, background: bgCard, border: `1px solid ${border}`, borderRadius: 12 }}>
            <p style={{ fontSize: 11, color: textSec, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Volume (24h)</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: textPrimary, margin: 0 }}>
              ${totalVolume >= 1_000_000
                ? `${(totalVolume / 1_000_000).toFixed(1)}M`
                : `${(totalVolume / 1_000).toFixed(0)}K`}
            </p>
            <p style={{ fontSize: 11, color: textSec, marginTop: 2 }}>Across all venues</p>
          </div>
          <div style={{ padding: 16, background: bgCard, border: `1px solid ${border}`, borderRadius: 12 }}>
            <p style={{ fontSize: 11, color: textSec, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Best Arb Spread</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: bestSpread > 0 ? '#34d399' : textPrimary, margin: 0 }}>
              {bestSpread > 0 ? `+${bestSpread.toFixed(1)}%` : '—'}
            </p>
            <p style={{ fontSize: 11, color: textSec, marginTop: 2 }}>{arbOpportunities.length} opportunities</p>
          </div>
        </div>

        {/* ── TAB BAR ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 12,
                fontSize: 14, fontWeight: 500,
                border: activeTab === tab.id ? `1px solid ${border}` : '1px solid transparent',
                background: activeTab === tab.id ? bgCard : 'transparent',
                color: activeTab === tab.id ? textPrimary : textSec,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <tab.icon style={{ width: 16, height: 16 }} />
              {tab.label}
              {tab.badge !== null && (
                <span style={{ marginLeft: 2, padding: '1px 6px', background: accent, color: 'white', fontSize: 11, borderRadius: 10, fontWeight: 700 }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT — scrollable ───────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
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

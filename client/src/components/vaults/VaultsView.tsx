/**
 * VaultsView.tsx
 * Full-page vaults terminal.
 * Tabs: Vaults | My Deposits | Performance
 * Theme-aware via optional `theme`/`isDark` props.
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

interface Props {
  theme?:  any;
  isDark?: boolean;
}

export function VaultsView({ theme, isDark }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('vaults');
  const { vaults, isLoading } = useVaults();

  const bgPrimary   = theme?.bgPrimary     ?? '#030712';
  const bgCard      = theme?.bgCard        ?? '#111827';
  const border      = theme?.border        ?? 'rgba(55,65,81,1)';
  const textPrimary = theme?.textPrimary   ?? '#ffffff';
  const textSec     = theme?.textSecondary ?? '#9ca3af';
  const accent      = theme?.accent        ?? '#8b5cf6';

  // Aggregate stats
  const totalTvl    = vaults.reduce((s, v) => s + parseFloat(v.totalAssetsFormatted), 0);
  const totalTvlStr = totalTvl >= 1_000_000
    ? `$${(totalTvl / 1_000_000).toFixed(2)}M`
    : totalTvl >= 1_000
    ? `$${(totalTvl / 1_000).toFixed(0)}K`
    : '—';

  const myTotal = vaults.reduce((s, v) => s + parseFloat(v.userAssetsFormatted), 0);
  const myTotalStr = myTotal > 0 ? myTotal.toFixed(4) : '—';
  const myBadge    = vaults.filter(v => v.userShares > 0n).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: bgPrimary, overflow: 'hidden' }}>

      {/* ── TOP HEADER ──────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: '24px 24px 16px', borderBottom: `1px solid ${border}` }}>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: textPrimary, margin: '0 0 2px' }}>Vaults</h1>
            <p style={{ fontSize: 14, color: textSec, margin: 0 }}>
              ERC-4626 yield vaults — deposit LP tokens, earn passive yield
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20 }}>
            <span className="animate-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: '#34d399' }}>Live</span>
          </div>
        </div>

        {/* ── STATS ROW ───────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
          {[
            { label: 'Total TVL',   value: totalTvlStr, sub: `across ${vaults.length} vaults`, green: false },
            { label: 'Avg APY',     value: formatApy(avgApyBps()), sub: 'across all strategies', green: true },
            { label: 'My Deposits', value: myTotalStr,  sub: 'LP tokens', green: false },
          ].map(s => (
            <div key={s.label} style={{ padding: 16, background: bgCard, border: `1px solid ${border}`, borderRadius: 12 }}>
              <p style={{ fontSize: 11, color: textSec, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>{s.label}</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: s.green ? '#34d399' : textPrimary, margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 11, color: textSec, marginTop: 2 }}>{s.sub}</p>
            </div>
          ))}
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
              {tab.id === 'deposits' && myBadge > 0 && (
                <span style={{ marginLeft: 2, padding: '1px 6px', background: accent, color: 'white', fontSize: 11, borderRadius: 10, fontWeight: 700 }}>
                  {myBadge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT — scrollable ─────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'vaults'      && <VaultsGrid vaults={vaults} isLoading={isLoading} theme={theme} isDark={isDark} />}
        {activeTab === 'deposits'    && <MyDepositsTab vaults={vaults} />}
        {activeTab === 'performance' && <PerformanceTab vaults={vaults} />}
      </div>
    </div>
  );
}

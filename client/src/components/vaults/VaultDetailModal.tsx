/**
 * VaultDetailModal.tsx
 * Full vault detail modal with Deposit / Withdraw tabs.
 * Centered overlay via createPortal — matches MarketDetailModal pattern.
 */

import { createPortal }   from 'react-dom';
import { useState }       from 'react';
import { X, TrendingUp, Shield, Zap, Info } from 'lucide-react';
import { DepositForm }    from './DepositForm';
import { WithdrawForm }   from './WithdrawForm';
import { formatApy, STRATEGY_LABELS, RISK_COLORS, type VaultStrategy, type VaultRisk } from '../../config/vaults.ts';
import type { VaultData } from '../../hooks/useVaults.ts';

const STRATEGY_ICONS: Record<VaultStrategy, React.FC<{ className?: string }>> = {
  stable: Shield,
  lp:     TrendingUp,
  multi:  Zap,
};

const STRATEGY_BG: Record<VaultStrategy, string> = {
  stable: 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300',
  lp:     'bg-blue-600/20 border-blue-500/40 text-blue-300',
  multi:  'bg-purple-600/20 border-purple-500/40 text-purple-300',
};

const formatTvl = (raw: string) => {
  const n = parseFloat(raw);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return n > 0 ? `$${n.toFixed(2)}` : '—';
};

type Tab = 'deposit' | 'withdraw';

interface Props {
  vault:   VaultData;
  onClose: () => void;
  theme?:  any;
}

export function VaultDetailModal({ vault, onClose, theme }: Props) {
  const [tab, setTab] = useState<Tab>('deposit');
  const StratIcon = STRATEGY_ICONS[vault.strategy];

  const bgCard   = theme?.bgCard     ?? '#111827';
  const border   = theme?.border     ?? 'rgba(55,65,81,1)';
  const textPri  = theme?.textPrimary   ?? '#ffffff';
  const textSec  = theme?.textSecondary ?? '#6b7280';
  const bgSec    = theme?.bgSecondary   ?? '#1f2937';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/70 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl flex flex-col"
        style={{ background: bgCard, border: `1px solid ${border}`, maxHeight: '88vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 p-5 flex-shrink-0" style={{ borderBottom: `1px solid ${border}` }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg
                               text-xs font-semibold border ${STRATEGY_BG[vault.strategy]}`}>
                <StratIcon className="w-3 h-3" />
                {STRATEGY_LABELS[vault.strategy]}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                               text-xs font-semibold border ${RISK_COLORS[vault.risk as VaultRisk]}`}>
                {vault.risk.charAt(0).toUpperCase() + vault.risk.slice(1)} Risk
              </span>
              {vault.isPaused && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold
                                 bg-yellow-900/50 text-yellow-300 border border-yellow-700/50">
                  ⏸ Paused
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold leading-snug" style={{ color: textPri }}>
              {vault.name}
            </h2>
            <p className="text-xs mt-1" style={{ color: textSec }}>{vault.description}</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
            style={{ color: textSec }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── KEY METRICS ─────────────────────────────────────────── */}
        <div className="grid grid-cols-3" style={{ borderBottom: `1px solid ${border}` }}>
          {[
            { label: 'APY',         value: formatApy(vault.liveApyBps), green: true },
            { label: 'TVL',         value: formatTvl(vault.totalAssetsFormatted), green: false },
            { label: 'Price/Share', value: vault.pricePerShare.toFixed(4), green: false },
          ].map((m, i) => (
            <div key={m.label} className="p-4" style={{ borderRight: i < 2 ? `1px solid ${border}` : undefined }}>
              <p className="text-xs mb-1 uppercase tracking-wide" style={{ color: textSec }}>{m.label}</p>
              <p className={`font-bold ${i === 0 ? 'text-3xl text-emerald-400' : 'text-xl'}`}
                 style={!m.green ? { color: textPri } : undefined}>
                {m.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── PAIR & SHARE INFO ────────────────────────────────────── */}
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${border}` }}>
          <div className="flex items-center gap-2 mb-1">
            <Info className="w-3.5 h-3.5" style={{ color: textSec }} />
            <span className="text-xs" style={{ color: textSec }}>Underlying pair</span>
            <span className="text-xs font-semibold" style={{ color: textPri }}>{vault.pair}</span>
          </div>
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5" style={{ color: textSec }} />
            <span className="text-xs" style={{ color: textSec }}>Share token</span>
            <span className="text-xs font-mono text-purple-300">{vault.shareSymbol}</span>
          </div>
        </div>

        {/* ── DEPOSIT / WITHDRAW TABS ──────────────────────────────── */}
        <div className="p-5">
          {/* Tab switcher */}
          <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: bgSec }}>
            <button
              onClick={() => setTab('deposit')}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: tab === 'deposit' ? bgCard : 'transparent', color: tab === 'deposit' ? textPri : textSec, border: tab === 'deposit' ? `1px solid ${border}` : '1px solid transparent' }}
            >
              Deposit
            </button>
            <button
              onClick={() => setTab('withdraw')}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: tab === 'withdraw' ? bgCard : 'transparent', color: tab === 'withdraw' ? textPri : textSec, border: tab === 'withdraw' ? `1px solid ${border}` : '1px solid transparent' }}
            >
              Withdraw
            </button>
          </div>

          {/* Tab content */}
          {tab === 'deposit'  && <DepositForm  vault={vault} />}
          {tab === 'withdraw' && <WithdrawForm vault={vault} />}
        </div>
      </div>
    </div>,
    document.body
  );
}

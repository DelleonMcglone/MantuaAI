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
}

export function VaultDetailModal({ vault, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('deposit');
  const StratIcon = STRATEGY_ICONS[vault.strategy];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/70 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-lg bg-gray-900 border border-gray-700
                   rounded-2xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 p-5 border-b border-gray-800 flex-shrink-0">
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
            <h2 className="text-base font-semibold text-white leading-snug">
              {vault.name}
            </h2>
            <p className="text-xs text-gray-500 mt-1">{vault.description}</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 hover:bg-gray-800 rounded-lg
                       text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── SCROLLABLE CONTENT ──────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1">

          {/* ── KEY METRICS ─────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-px bg-gray-800 border-b border-gray-800">
            <div className="p-4 bg-gray-900">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">APY</p>
              <p className="text-3xl font-bold text-emerald-400">
                {formatApy(vault.liveApyBps)}
              </p>
            </div>
            <div className="p-4 bg-gray-900">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">TVL</p>
              <p className="text-xl font-bold text-white">
                {formatTvl(vault.totalAssetsFormatted)}
              </p>
            </div>
            <div className="p-4 bg-gray-900">
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Price/Share</p>
              <p className="text-xl font-bold text-white">
                {vault.pricePerShare.toFixed(4)}
              </p>
            </div>
          </div>

          {/* ── PAIR & SHARE INFO ────────────────────────────────────── */}
          <div className="px-5 py-4 border-b border-gray-800">
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-xs text-gray-500">Underlying pair</span>
              <span className="text-xs font-semibold text-white">{vault.pair}</span>
            </div>
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-xs text-gray-500">Share token</span>
              <span className="text-xs font-mono text-purple-300">{vault.shareSymbol}</span>
            </div>
          </div>

          {/* ── DEPOSIT / WITHDRAW TABS ──────────────────────────────── */}
          <div className="p-5">
            {/* Tab switcher */}
            <div className="flex gap-1 p-1 bg-gray-800 rounded-xl mb-4">
              <button
                onClick={() => setTab('deposit')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === 'deposit'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Deposit
              </button>
              <button
                onClick={() => setTab('withdraw')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === 'withdraw'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Withdraw
              </button>
            </div>

            {/* Tab content */}
            {tab === 'deposit'  && <DepositForm  vault={vault} />}
            {tab === 'withdraw' && <WithdrawForm vault={vault} />}
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}

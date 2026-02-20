/**
 * VaultCard.tsx
 * Single vault card for the VaultsGrid.
 * APY is the dominant visual. Strategy badge + risk level in footer.
 * Theme-aware via optional `theme` prop.
 */

import { useState } from 'react';
import { TrendingUp, Shield, Zap } from 'lucide-react';
import {
  formatApy,
  STRATEGY_LABELS,
  RISK_COLORS,
  type VaultStrategy,
  type VaultRisk,
} from '../../config/vaults.ts';
import type { VaultData } from '../../hooks/useVaults.ts';

const STRATEGY_ICONS: Record<VaultStrategy, React.FC<{ className?: string }>> = {
  stable: Shield,
  lp:     TrendingUp,
  multi:  Zap,
};

const STRATEGY_BG: Record<VaultStrategy, string> = {
  stable: 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300',
  lp:     'bg-blue-900/20 border-blue-700/40 text-blue-300',
  multi:  'bg-purple-900/20 border-purple-700/40 text-purple-300',
};

const formatTvl = (raw: string): string => {
  const n = parseFloat(raw);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

interface Props {
  vault:   VaultData;
  onClick: () => void;
  theme?:  any;
}

export function VaultCard({ vault, onClick, theme }: Props) {
  const StratIcon  = STRATEGY_ICONS[vault.strategy];
  const apyStr     = formatApy(vault.liveApyBps);
  const tvlStr     = formatTvl(vault.totalAssetsFormatted);
  const userAmt    = parseFloat(vault.userAssetsFormatted);
  const hasDeposit = userAmt > 0;
  const [hovered, setHovered] = useState(false);

  const cardBg     = theme ? (hovered ? theme.bgSecondary : theme.bgCard) : undefined;
  const cardBorder = theme ? theme.border : undefined;
  const textPrimary    = theme ? theme.textPrimary    : undefined;
  const textSecondary  = theme ? theme.textSecondary  : undefined;

  return (
    <button
      onClick={onClick}
      disabled={vault.isPaused}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`w-full text-left p-5 rounded-2xl transition-all duration-150 group
                 disabled:opacity-60 disabled:cursor-not-allowed${
        theme ? '' : ' bg-gray-900 hover:bg-gray-800/70 border border-gray-800 hover:border-gray-600'
      }`}
      style={theme ? {
        background: cardBg,
        border: `1px solid ${cardBorder}`,
      } : undefined}
    >
      {/* ── ROW 1: Strategy badge + risk ────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                         text-xs font-semibold border ${STRATEGY_BG[vault.strategy]}`}>
          <StratIcon className="w-3 h-3" />
          {STRATEGY_LABELS[vault.strategy]}
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                         text-xs font-semibold border ${RISK_COLORS[vault.risk as VaultRisk]}`}>
          {vault.risk.charAt(0).toUpperCase() + vault.risk.slice(1)} Risk
        </span>
      </div>

      {/* ── ROW 2: Name ─────────────────────────────────────────── */}
      <p className="text-sm font-semibold leading-snug mb-1 line-clamp-2"
         style={{ color: textPrimary ?? undefined }}>
        <span className={theme ? '' : 'text-white group-hover:text-gray-100'}>{vault.name}</span>
      </p>
      <p className="text-xs mb-4 line-clamp-2"
         style={{ color: textSecondary ?? '#6b7280' }}>
        {vault.description}
      </p>

      {/* ── APY: dominant visual ─────────────────────────────────── */}
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide mb-1" style={{ color: textSecondary ?? '#6b7280' }}>APY</p>
        <p className="text-4xl font-bold text-emerald-400">{apyStr}</p>
      </div>

      {/* ── PAUSED banner ───────────────────────────────────────── */}
      {vault.isPaused && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3
                        bg-yellow-900/30 border border-yellow-700/40 text-yellow-300
                        text-xs font-semibold">
          ⏸ Vault Paused
        </div>
      )}

      {/* ── FOOTER: TVL + user deposit ──────────────────────────── */}
      <div className="flex items-center justify-between pt-3 text-xs"
           style={{ borderTop: `1px solid ${cardBorder ?? 'rgba(55,65,81,1)'}`, color: textSecondary ?? '#6b7280' }}>
        <span className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3" />
          {tvlStr}
          <span style={{ opacity: 0.5 }}>TVL</span>
        </span>
        {hasDeposit && (
          <span className="text-emerald-400 font-semibold">
            {userAmt.toFixed(2)} deposited
          </span>
        )}
      </div>
    </button>
  );
}

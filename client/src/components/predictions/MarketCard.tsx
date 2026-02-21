/**
 * MarketCard.tsx
 * Single prediction market card.
 * YES probability is the dominant visual. Venue badge top-left.
 * Full card is clickable to open MarketDetailModal.
 */

import { Calendar, TrendingUp, Lock } from 'lucide-react';

export interface AnyMarket {
  id:        any;
  question:  string;
  category:  string;
  yesPrice:  number;
  noPrice:   number;
  volume24h: number;
  endDate?:  string;
  endTime?:  number;
  resolved?: boolean;
  outcome?:  boolean;
  source:    string;
}

const formatVol = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000   ? `$${(v / 1_000).toFixed(0)}K`
  : `$${v}`;

export function MarketCard({ market, onClick }: { market: AnyMarket; onClick: () => void }) {
  const yesPct = Math.round(market.yesPrice * 100);
  const noPct  = 100 - yesPct;

  const endLabel = market.endDate
    ? new Date(market.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
    : market.endTime
      ? new Date(market.endTime * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
      : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-5 bg-gray-900 hover:bg-gray-800/70
                 border border-gray-800 hover:border-gray-600
                 rounded-2xl transition-all duration-150 group"
    >
      {/* ── ROW 2: Question ────────────────────────────────────── */}
      <p className="text-sm font-semibold text-white leading-snug mb-4
                   group-hover:text-gray-100 line-clamp-2 min-h-[2.5rem]">
        {market.question}
      </p>

      {/* ── RESOLVED BANNER ────────────────────────────────────── */}
      {market.resolved && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-3
                        text-xs font-semibold ${
          market.outcome
            ? 'bg-emerald-900/40 border border-emerald-700/50 text-emerald-300'
            : 'bg-red-900/40 border border-red-700/50 text-red-300'
        }`}>
          <Lock className="w-3 h-3" />
          Resolved: {market.outcome ? 'YES ✓' : 'NO ✗'}
        </div>
      )}

      {/* ── PROBABILITY BAR ────────────────────────────────────── */}
      {!market.resolved && (
        <div className="mb-4">
          {/* Labels */}
          <div className="flex justify-between items-baseline mb-1.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-emerald-400">{yesPct}¢</span>
              <span className="text-xs text-gray-500">YES</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xs text-gray-500">NO</span>
              <span className="text-xl font-bold text-red-400">{noPct}¢</span>
            </div>
          </div>
          {/* Bar */}
          <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-800">
            <div
              className="bg-emerald-500 transition-all rounded-l-full"
              style={{ width: `${yesPct}%` }}
            />
            <div className="bg-red-500 flex-1 rounded-r-full" />
          </div>
        </div>
      )}

      {/* ── FOOTER: Volume + End date ───────────────────────────── */}
      <div className="flex items-center justify-between pt-3
                      border-t border-gray-800 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3" />
          {formatVol(market.volume24h)}
          <span className="text-gray-700">vol 24h</span>
        </span>
        {endLabel && (
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            {endLabel}
          </span>
        )}
      </div>
    </button>
  );
}

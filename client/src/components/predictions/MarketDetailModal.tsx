/**
 * MarketDetailModal.tsx
 * Full market detail modal. Centered overlay via createPortal.
 * - Mantua markets: shows BetForm + admin ResolvePanel + claim flow
 * - Polymarket: external trade link
 * - Kalshi: read-only info + Kalshi link
 *
 * Design matches Swap modal and Add Liquidity modal patterns.
 */

import { createPortal }                   from 'react-dom';
import { useState }                       from 'react';
import { X, ExternalLink, TrendingUp, Calendar } from 'lucide-react';
import { useAccount, useWriteContract,
         useWaitForTransactionReceipt,
         useChainId }                     from 'wagmi';
import { BetForm }                        from './BetForm';
import { ResolvePanel }                   from './ResolvePanel';
import { getPredictionMarketAddress }     from '../../config/contracts';
import MantuaPredictionMarketABI          from '../../abis/MantuaPredictionMarket.json';

const ADMIN_ADDRESS = (import.meta.env.VITE_ADMIN_ADDRESS ?? '').toLowerCase();

const VENUE_COLORS: Record<string, string> = {
  mantua:     'bg-purple-600/20 border-purple-500/40 text-purple-300',
  polymarket: 'bg-blue-600/20 border-blue-500/40 text-blue-300',
  kalshi:     'bg-emerald-600/20 border-emerald-500/40 text-emerald-300',
};

const formatVol = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : `$${(v / 1_000).toFixed(0)}K`;

function ClaimButton({ marketId }: { marketId: number }) {
  const chainId         = useChainId();
  const contractAddress = getPredictionMarketAddress(chainId);
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess) {
    return <p className="text-emerald-400 text-sm font-semibold text-center py-2">✅ Winnings claimed!</p>;
  }

  return (
    <button
      onClick={() => {
        if (!contractAddress) return;
        writeContract({
          address:      contractAddress,
          abi:          MantuaPredictionMarketABI,
          functionName: 'claimWinnings',
          args:         [BigInt(marketId)],
        });
      }}
      disabled={isPending || !contractAddress}
      className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-blue-600
                 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl
                 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-wait"
    >
      {isPending ? 'Claiming…' : 'Claim Winnings'}
    </button>
  );
}

export function MarketDetailModal({ market, onClose }: { market: any; onClose: () => void }) {
  const { address } = useAccount();
  const isAdmin    = address?.toLowerCase() === ADMIN_ADDRESS && ADMIN_ADDRESS !== '';
  const isMantua   = market.source === 'mantua';
  const isResolved = Boolean(market.resolved);
  const yesPct     = Math.round(market.yesPrice * 100);
  const noPct      = 100 - yesPct;

  const endLabel = market.endDate
    ? new Date(market.endDate).toLocaleDateString('en-US',
        { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : market.endTime
      ? new Date(market.endTime * 1000).toLocaleDateString('en-US',
          { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      : null;

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
        {/* ── HEADER ─────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 p-5 border-b border-gray-800 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2.5 flex-wrap">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg
                               text-xs font-semibold border ${
                VENUE_COLORS[market.source] ?? VENUE_COLORS.mantua
              }`}>
                {(market.source as string).charAt(0).toUpperCase() + (market.source as string).slice(1)}
              </span>
              <span className="text-xs text-gray-500 capitalize">{market.category}</span>
              {isResolved && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  market.outcome
                    ? 'bg-emerald-900/50 text-emerald-300'
                    : 'bg-red-900/50 text-red-300'
                }`}>
                  Resolved: {market.outcome ? 'YES' : 'NO'}
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-white leading-snug">
              {market.question}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 hover:bg-gray-800 rounded-lg
                       text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── SCROLLABLE CONTENT ─────────────────────────────────── */}
        <div className="overflow-y-auto flex-1">

          {/* ── ODDS DISPLAY ─────────────────────────────────────── */}
          <div className="p-5 border-b border-gray-800">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={`p-4 rounded-xl border ${
                !isResolved
                  ? 'bg-emerald-900/20 border-emerald-800/50'
                  : market.outcome
                    ? 'bg-emerald-900/30 border-emerald-600/60 ring-2 ring-emerald-500/30'
                    : 'bg-gray-800/50 border-gray-700/50 opacity-50'
              }`}>
                <p className="text-xs font-semibold text-emerald-400 mb-1 uppercase tracking-wide">
                  YES {isResolved && market.outcome ? '✓ Winner' : ''}
                </p>
                <p className="text-4xl font-bold text-emerald-400">{yesPct}¢</p>
                <p className="text-xs text-gray-500 mt-1">{yesPct}% probability</p>
              </div>
              <div className={`p-4 rounded-xl border ${
                !isResolved
                  ? 'bg-red-900/20 border-red-800/50'
                  : !market.outcome
                    ? 'bg-red-900/30 border-red-600/60 ring-2 ring-red-500/30'
                    : 'bg-gray-800/50 border-gray-700/50 opacity-50'
              }`}>
                <p className="text-xs font-semibold text-red-400 mb-1 uppercase tracking-wide">
                  NO {isResolved && !market.outcome ? '✓ Winner' : ''}
                </p>
                <p className="text-4xl font-bold text-red-400">{noPct}¢</p>
                <p className="text-xs text-gray-500 mt-1">{noPct}% probability</p>
              </div>
            </div>

            {/* Probability bar */}
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-800">
              <div className="bg-emerald-500 transition-all rounded-l-full"
                   style={{ width: `${yesPct}%` }} />
              <div className="bg-red-500 flex-1 rounded-r-full" />
            </div>
          </div>

          {/* ── MARKET METADATA ────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-px bg-gray-800 border-b border-gray-800">
            <div className="p-4 bg-gray-900">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" /> Volume (24h)
              </p>
              <p className="text-sm font-semibold text-white">
                {formatVol(market.volume24h ?? 0)}
              </p>
            </div>
            <div className="p-4 bg-gray-900">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" /> Closes
              </p>
              <p className="text-sm font-semibold text-white">{endLabel ?? '—'}</p>
            </div>
          </div>

          {/* ── MANTUA: Bet form ───────────────────────────────────── */}
          {isMantua && !isResolved && (
            <div className="p-5">
              <BetForm marketId={market.id} yesPrice={market.yesPrice} />
            </div>
          )}

          {/* ── MANTUA resolved: Claim ─────────────────────────────── */}
          {isMantua && isResolved && (
            <div className="p-5">
              <p className="text-sm text-gray-400 text-center mb-4">
                This market has been resolved. If you hold winning shares, claim below.
              </p>
              <ClaimButton marketId={market.id} />
            </div>
          )}

          {/* ── MANTUA admin: Resolve panel ────────────────────────── */}
          {isMantua && !isResolved && isAdmin && (
            <div className="px-5 pb-5">
              <ResolvePanel
                marketId={market.id}
                marketResolver=""
                marketEndTime={market.endTime ?? 0}
              />
            </div>
          )}

          {/* ── POLYMARKET: External link ──────────────────────────── */}
          {market.source === 'polymarket' && (
            <div className="p-5">
              <p className="text-xs text-gray-500 text-center mb-4">
                This market is hosted on Polymarket. Trading requires USDC on Polygon.
              </p>
              <a
                href={`https://polymarket.com/event/${market.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5
                           bg-blue-600 hover:bg-blue-500 text-white rounded-xl
                           font-semibold text-sm transition-colors"
              >
                Trade on Polymarket
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* ── KALSHI: Read-only + external link ─────────────────── */}
          {market.source === 'kalshi' && (
            <div className="p-5">
              <div className="p-3 bg-amber-900/20 border border-amber-700/40
                              rounded-xl mb-4">
                <p className="text-xs text-amber-300 text-center">
                  Kalshi requires KYC verification. Live data shown for comparison only.
                </p>
              </div>
              <a
                href="https://kalshi.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5
                           bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl
                           font-semibold text-sm transition-colors"
              >
                Trade on Kalshi
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}

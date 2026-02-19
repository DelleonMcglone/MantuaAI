/**
 * ArbitrageTab.tsx
 * Cross-venue arbitrage opportunities ranked by spread %.
 * Each card: question, venue A vs venue B, spread %, action instruction.
 */

import { Zap, AlertCircle, ArrowRight } from 'lucide-react';
import type { ArbOpportunity } from '../../hooks/useArbitrage';

interface Props { opportunities: ArbOpportunity[]; }

const CONFIDENCE_RING: Record<string, string> = {
  high:   'border-emerald-700/60 hover:border-emerald-600',
  medium: 'border-yellow-700/50  hover:border-yellow-600',
  low:    'border-gray-700/50    hover:border-gray-600',
};
const SPREAD_COLOR: Record<string, string> = {
  high: 'text-emerald-400', medium: 'text-yellow-400', low: 'text-gray-400',
};

export function ArbitrageTab({ opportunities }: Props) {
  if (opportunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-600">
        <div className="w-12 h-12 rounded-2xl bg-gray-900 border border-gray-800
                        flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6 opacity-50" />
        </div>
        <p className="text-sm font-medium text-gray-500">No arbitrage found right now</p>
        <p className="text-xs mt-1 text-gray-700">Markets refresh every 60 seconds</p>
      </div>
    );
  }

  const highConf = opportunities.filter(o => o.confidence === 'high').length;

  return (
    <div className="p-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
          <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
            Opportunities
          </p>
          <p className="text-2xl font-bold text-white">{opportunities.length}</p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
          <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
            Best Spread
          </p>
          <p className="text-2xl font-bold text-emerald-400">
            +{opportunities[0].spreadPct.toFixed(1)}%
          </p>
        </div>
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
          <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">
            High Confidence
          </p>
          <p className="text-2xl font-bold text-white">{highConf}</p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 bg-amber-900/10 border border-amber-800/30
                      rounded-xl mb-6 text-xs text-amber-400/80">
        <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>
          Arbitrage requires simultaneous execution on both venues. Spreads may close
          before you trade. Always verify odds before placing positions.
        </span>
      </div>

      {/* Opportunity cards */}
      <div className="flex flex-col gap-4">
        {opportunities.map(opp => (
          <div
            key={opp.id}
            className={`p-5 bg-gray-900 rounded-2xl border transition-all ${
              CONFIDENCE_RING[opp.confidence]
            }`}
          >
            {/* Question + spread */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <p className="text-sm font-semibold text-white leading-snug flex-1">
                {opp.question}
              </p>
              <div className="text-right flex-shrink-0">
                <p className={`text-2xl font-bold ${SPREAD_COLOR[opp.confidence]}`}>
                  +{opp.spreadPct.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-600 capitalize">{opp.confidence}</p>
              </div>
            </div>

            {/* Venue comparison */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 p-3 bg-gray-800 rounded-xl">
                <p className="text-xs text-gray-500 font-medium capitalize mb-1">
                  {opp.venueA}
                </p>
                <p className="text-base font-bold text-emerald-400">
                  Buy YES @ {Math.round(opp.yesPriceA * 100)}¢
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
              <div className="flex-1 p-3 bg-gray-800 rounded-xl">
                <p className="text-xs text-gray-500 font-medium capitalize mb-1">
                  {opp.venueB}
                </p>
                <p className="text-base font-bold text-red-400">
                  Buy NO @ {Math.round((1 - opp.yesPriceB) * 100)}¢
                </p>
              </div>
            </div>

            {/* Action instruction */}
            <div className="flex items-center gap-2 px-3 py-2.5
                            bg-gray-800/80 rounded-xl border border-gray-700/50">
              <Zap className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
              <p className="text-xs text-gray-300">{opp.action}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

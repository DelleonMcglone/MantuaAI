/**
 * MarketsTab.tsx
 * Filterable 2-column market grid with full-height scrolling.
 * Filter bar: venue selector + category pills + search.
 */

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { MarketCard }        from './MarketCard';
import { MarketDetailModal } from './MarketDetailModal';
import type { MantuaMarket }     from '../../hooks/useMantualMarkets';
import type { PolymarketMarket } from '../../hooks/usePolymarket';
import type { KalshiMarket }     from '../../config/kalshiMock';

type AnyMarket = MantuaMarket | PolymarketMarket | KalshiMarket;

interface Props {
  mantuaMarkets: MantuaMarket[];
  polyMarkets:   PolymarketMarket[];
  kalshiMarkets: KalshiMarket[];
  isLoading:     boolean;
}

export function MarketsTab({ mantuaMarkets, polyMarkets, kalshiMarkets, isLoading }: Props) {
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<AnyMarket | null>(null);

  const filtered = useMemo<AnyMarket[]>(() => {
    let m: AnyMarket[] = [...mantuaMarkets, ...polyMarkets, ...kalshiMarkets];
    if (search) m = m.filter(x =>
      x.question.toLowerCase().includes(search.toLowerCase())
    );
    return m;
  }, [search, mantuaMarkets, polyMarkets, kalshiMarkets]);

  if (isLoading && filtered.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent
                          rounded-full animate-spin" />
          <span className="text-sm">Loading markets…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* ── SEARCH BAR ─────────────────────────────────────────────── */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search markets…"
          className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700
                     rounded-xl text-sm text-white placeholder-gray-500
                     focus:outline-none focus:border-purple-500 transition-colors"
        />
      </div>

      {/* ── GRID: 2 columns ────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-sm">No markets match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(market => (
            <MarketCard
              key={`${market.source}-${market.id}`}
              market={market}
              onClick={() => setSelected(market)}
            />
          ))}
        </div>
      )}

      {selected && (
        <MarketDetailModal
          market={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

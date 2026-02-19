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

const VENUES     = ['all', 'mantua', 'polymarket', 'kalshi'] as const;
const CATEGORIES = ['all', 'crypto', 'politics', 'sports', 'economics'] as const;

interface Props {
  mantuaMarkets: MantuaMarket[];
  polyMarkets:   PolymarketMarket[];
  kalshiMarkets: KalshiMarket[];
  isLoading:     boolean;
}

export function MarketsTab({ mantuaMarkets, polyMarkets, kalshiMarkets, isLoading }: Props) {
  const [venue,    setVenue]    = useState<typeof VENUES[number]>('all');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('all');
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<AnyMarket | null>(null);

  const filtered = useMemo<AnyMarket[]>(() => {
    let m: AnyMarket[] = [];
    if (venue === 'all' || venue === 'mantua')     m.push(...mantuaMarkets);
    if (venue === 'all' || venue === 'polymarket') m.push(...polyMarkets);
    if (venue === 'all' || venue === 'kalshi')     m.push(...kalshiMarkets);
    if (category !== 'all') m = m.filter(x => x.category === category);
    if (search)             m = m.filter(x =>
      x.question.toLowerCase().includes(search.toLowerCase())
    );
    return m;
  }, [venue, category, search, mantuaMarkets, polyMarkets, kalshiMarkets]);

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
      {/* ── FILTER BAR ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 mb-6">

        {/* Search */}
        <div className="relative">
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

        {/* Venue + Category filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Venue filter */}
          <div className="flex items-center gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl">
            {VENUES.map(v => (
              <button
                key={v}
                onClick={() => setVenue(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize
                           transition-colors ${
                  venue === v
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-gray-800" />

          {/* Category filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize
                           transition-colors ${
                  category === c
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white bg-gray-900 border border-gray-800'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result count */}
      <p className="text-xs text-gray-600 mb-4 font-medium">
        {filtered.length} market{filtered.length !== 1 ? 's' : ''}
      </p>

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

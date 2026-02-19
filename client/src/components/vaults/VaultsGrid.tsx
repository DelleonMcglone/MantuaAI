/**
 * VaultsGrid.tsx
 * Filterable 2-column vault grid.
 * Strategy filter pills on top. Shows VaultDetailModal on card click.
 */

import { useState } from 'react';
import { VaultCard }        from './VaultCard';
import { VaultDetailModal } from './VaultDetailModal';
import type { VaultData }   from '../../hooks/useVaults.ts';
import type { VaultStrategy } from '../../config/vaults.ts';

type Filter = 'all' | VaultStrategy;
const FILTERS: Filter[] = ['all', 'stable', 'lp', 'multi'];

const FILTER_LABELS: Record<Filter, string> = {
  all:    'All',
  stable: 'Stable',
  lp:     'LP',
  multi:  'Multi',
};

interface Props {
  vaults:    VaultData[];
  isLoading: boolean;
}

export function VaultsGrid({ vaults, isLoading }: Props) {
  const [filter,   setFilter]   = useState<Filter>('all');
  const [selected, setSelected] = useState<VaultData | null>(null);

  const filtered = filter === 'all'
    ? vaults
    : vaults.filter(v => v.strategy === filter);

  if (isLoading && vaults.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent
                          rounded-full animate-spin" />
          <span className="text-sm">Loading vaults…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* ── STRATEGY FILTER ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 bg-gray-900 border border-gray-800
                      rounded-xl mb-6 w-fit">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize
                       transition-colors ${
              filter === f
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Result count */}
      <p className="text-xs text-gray-600 mb-4 font-medium">
        {filtered.length} vault{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* ── GRID ────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-sm">No vaults match this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(vault => (
            <VaultCard
              key={vault.id}
              vault={vault}
              onClick={() => setSelected(vault)}
            />
          ))}
        </div>
      )}

      {selected && (
        <VaultDetailModal
          vault={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

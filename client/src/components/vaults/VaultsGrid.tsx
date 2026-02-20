/**
 * VaultsGrid.tsx
 * Filterable 2-column vault grid.
 * Strategy filter pills on top. Shows VaultDetailModal on card click.
 * Theme-aware via optional `theme`/`isDark` props.
 */

import { useState } from 'react';
import { VaultCard }        from './VaultCard';
import { VaultDetailModal } from './VaultDetailModal';
import type { VaultData }   from '../../hooks/useVaults.ts';
import type { VaultStrategy } from '../../config/vaults.ts';
import { SkeletonBox, SkeletonLine } from '../ui/skeleton';

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
  theme?:    any;
  isDark?:   boolean;
}

export function VaultsGrid({ vaults, isLoading, theme, isDark }: Props) {
  const [filter,   setFilter]   = useState<Filter>('all');
  const [selected, setSelected] = useState<VaultData | null>(null);

  const filtered = filter === 'all'
    ? vaults
    : vaults.filter(v => v.strategy === filter);

  if (isLoading && vaults.length === 0) {
    return (
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-5 rounded-2xl space-y-4"
               style={{ background: theme?.bgCard ?? '#111827', border: `1px solid ${theme?.border ?? 'rgba(55,65,81,1)'}` }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SkeletonBox className="w-10 h-10 rounded-xl" />
                <div className="space-y-2">
                  <SkeletonLine className="w-28" />
                  <SkeletonLine className="w-16 h-3" />
                </div>
              </div>
              <SkeletonLine className="w-16 h-6 rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <SkeletonLine className="h-12 rounded-lg" />
              <SkeletonLine className="h-12 rounded-lg" />
              <SkeletonLine className="h-12 rounded-lg" />
            </div>
            <SkeletonBox className="w-full h-9 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* ── STRATEGY FILTER ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-xl mb-6 w-fit"
           style={{ background: theme?.bgSecondary ?? '#111827', border: `1px solid ${theme?.border ?? 'rgba(55,65,81,1)'}` }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
              filter === f
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                : 'hover:bg-gray-800/50'
            }`}
            style={filter !== f ? { color: theme?.textSecondary ?? '#9ca3af' } : undefined}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Result count */}
      <p className="text-xs mb-4 font-medium" style={{ color: theme?.textSecondary ?? '#4b5563' }}>
        {filtered.length} vault{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* ── GRID ────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: theme?.textSecondary ?? '#4b5563' }}>
          <p className="text-sm">No vaults match this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(vault => (
            <VaultCard
              key={vault.id}
              vault={vault}
              onClick={() => setSelected(vault)}
              theme={theme}
            />
          ))}
        </div>
      )}

      {selected && (
        <VaultDetailModal
          vault={selected}
          onClose={() => setSelected(null)}
          theme={theme}
        />
      )}
    </div>
  );
}

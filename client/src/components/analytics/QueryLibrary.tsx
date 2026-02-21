import React from 'react';

interface QueryChip {
  label:   string;
  message: string;
  icon:    string;
}

const QUERIES: QueryChip[] = [
  { label: 'Protocol Stats',       message: 'Show me the protocol stats',                     icon: '📊' },
  { label: 'Swap Volume (7d)',     message: 'Show swap volume over the last 7 days',           icon: '📈' },
  { label: 'Top Pools by TVL',     message: 'Show me the top pools by TVL',                    icon: '💧' },
  { label: 'Recent Swaps',         message: 'Show me the most recent swaps',                   icon: '🔄' },
  { label: 'Vault TVL Breakdown',  message: 'Show me vault TVL breakdown as a pie chart',      icon: '🏦' },
  { label: 'My Positions',         message: 'Show me my positions and deposits',               icon: '👤' },
  { label: 'Pool Leaderboard',     message: 'Show me the pool leaderboard by volume',          icon: '🏆' },
];

interface Props {
  onSelect: (message: string) => void;
  theme:    any;
  isDark:   boolean;
}

export function QueryLibrary({ onSelect, theme, isDark }: Props) {
  const bg = isDark ? 'rgba(139, 92, 246, 0.08)' : 'rgba(139, 92, 246, 0.06)';
  const bgHover = isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.12)';
  const border = isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)';
  const textColor = theme?.textSecondary ?? (isDark ? '#94a3b8' : '#64748b');

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 8,
      padding: '8px 0',
    }}>
      {QUERIES.map((q) => (
        <button
          key={q.label}
          data-testid={`query-chip-${q.label.toLowerCase().replace(/\s+/g, '-')}`}
          onClick={() => onSelect(q.message)}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = bgHover; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = bg; }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 20,
            background: bg, border: `1px solid ${border}`,
            color: textColor, fontSize: 12, fontWeight: 500,
            cursor: 'pointer', whiteSpace: 'nowrap',
            fontFamily: '"DM Sans", sans-serif',
            transition: 'background 0.2s',
          }}
        >
          <span>{q.icon}</span>
          <span>{q.label}</span>
        </button>
      ))}
    </div>
  );
}

export default QueryLibrary;

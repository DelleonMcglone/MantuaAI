/**
 * DuneResultTable
 * Renders Dune Analytics query results as a formatted table.
 * - Large numbers formatted: 1,234,567 → 1.23M / 45,300 → 45.3K
 * - Wallet addresses truncated: 0x1234...5678
 * - Shows "View on Dune →" link for full dataset
 * - Shows row count, column headers
 */

import React from 'react';

export interface DuneData {
  rows: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  label: string;
  duneUrl?: string;
}

interface DuneResultTableProps {
  data: DuneData;
  isDark?: boolean;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000)     return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000)         return `${(value / 1_000).toFixed(2)}K`;
    if (value % 1 !== 0)        return value.toFixed(4);
    return value.toLocaleString();
  }
  if (typeof value === 'string') {
    if (value.startsWith('0x') && value.length > 12) {
      return `${value.slice(0, 6)}...${value.slice(-4)}`;
    }
    // Truncate long strings
    if (value.length > 40) return value.slice(0, 37) + '…';
    return value;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function formatColumnHeader(col: string): string {
  return col
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

export function DuneResultTable({ data, isDark = true }: DuneResultTableProps) {
  const { rows, columns, rowCount, label, duneUrl } = data;
  const displayRows = rows.slice(0, 20);

  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const headerBg    = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const rowHoverBg  = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const textPrimary = isDark ? '#e2e8f0' : '#0f172a';
  const textMuted   = isDark ? '#64748b' : '#94a3b8';

  return (
    <div style={{
      background: isDark ? '#0f172a' : '#fff',
      border: `1px solid ${borderColor}`,
      borderRadius: 12,
      overflow: 'hidden',
      width: '100%',
      maxWidth: 700,
      fontFamily: '"DM Sans", sans-serif',
      marginTop: 4,
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: `1px solid ${borderColor}`,
        background: headerBg,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🟡</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: textMuted }}>{rowCount.toLocaleString()} rows</span>
          {duneUrl && (
            <a
              href={duneUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: '#f59e0b', textDecoration: 'none', opacity: 0.9 }}
            >
              View on Dune →
            </a>
          )}
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: textMuted, fontSize: 13 }}>
          No data returned.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: headerBg }}>
                {columns.map(col => (
                  <th key={col} style={{
                    padding: '8px 14px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: textMuted,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                    borderBottom: `1px solid ${borderColor}`,
                  }}>
                    {formatColumnHeader(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: i < displayRows.length - 1 ? `1px solid ${borderColor}` : 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = rowHoverBg; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                >
                  {columns.map(col => (
                    <td key={col} style={{
                      padding: '8px 14px',
                      color: textPrimary,
                      whiteSpace: 'nowrap',
                      fontFamily: typeof row[col] === 'number' ? 'monospace' : 'inherit',
                    }}>
                      {formatCellValue(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer — show if results were capped */}
      {rowCount > 20 && (
        <div style={{
          padding: '8px 16px',
          textAlign: 'center',
          fontSize: 11,
          color: textMuted,
          borderTop: `1px solid ${borderColor}`,
        }}>
          Showing 20 of {rowCount.toLocaleString()} rows.{' '}
          {duneUrl && (
            <a href={duneUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>
              View all on Dune →
            </a>
          )}
        </div>
      )}

      {/* Attribution */}
      <div style={{
        padding: '6px 16px',
        borderTop: `1px solid ${borderColor}`,
        fontSize: 10,
        color: textMuted,
        textAlign: 'right',
      }}>
        Powered by{' '}
        <a href="https://dune.com" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>
          Dune Analytics
        </a>
      </div>
    </div>
  );
}

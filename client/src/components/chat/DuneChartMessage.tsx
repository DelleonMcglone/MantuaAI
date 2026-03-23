/**
 * DuneChartMessage.tsx
 * Renders Dune Analytics query results inline in the chat.
 * Supports line, bar, pie, counter, and table visualizations.
 * Replaces the old ChartMessage ("Powered by The Graph") for analytics results.
 */

import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface VisualizationData {
  type: 'line' | 'bar' | 'pie' | 'counter' | 'table';
  title: string;
  data: Record<string, unknown>[];
  xKey?: string;
  yKey?: string;
}

interface Props {
  visualization: VisualizationData;
  summary: string;
  thoughts?: string[];
  theme?: Record<string, string>;
  isDark?: boolean;
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];

export function DuneChartMessage({ visualization, summary, thoughts = [], theme, isDark = true }: Props) {
  const [showThoughts, setShowThoughts] = useState(false);
  const bg = theme?.bgCard ?? (isDark ? '#111827' : '#ffffff');
  const border = theme?.border ?? (isDark ? '#1f2937' : 'rgba(0,0,0,0.08)');
  const textPrimary = theme?.textPrimary ?? (isDark ? '#e5e7eb' : '#0f172a');
  const textSecondary = theme?.textSecondary ?? (isDark ? '#9ca3af' : '#6b7280');
  const gridColor = isDark ? '#1f2937' : '#e5e7eb';

  const xField = visualization.xKey ?? 'date';
  const yField = visualization.yKey ?? 'value';
  const data = visualization.data ?? [];

  return (
    <div style={{
      width: '100%',
      maxWidth: 640,
      borderRadius: 16,
      border: `1px solid ${border}`,
      background: bg,
      overflow: 'hidden',
      fontFamily: '"DM Sans", sans-serif',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: textPrimary, margin: 0 }}>
          {visualization.title}
        </p>
      </div>

      {/* Chart body */}
      <div style={{ padding: 16 }}>
        {data.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                        height: 120, color: textSecondary, fontSize: 13 }}>
            No data returned for this query.
          </div>
        ) : (
          <>
            {visualization.type === 'line' && (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey={xField} tick={{ fill: textSecondary, fontSize: 10 }} />
                  <YAxis tick={{ fill: textSecondary, fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: isDark ? '#0f172a' : '#fff', border: `1px solid ${gridColor}`, fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey={yField} stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
            {visualization.type === 'bar' && (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey={xField} tick={{ fill: textSecondary, fontSize: 10 }} />
                  <YAxis tick={{ fill: textSecondary, fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: isDark ? '#0f172a' : '#fff', border: `1px solid ${gridColor}`, fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey={yField} fill="#6366f1" radius={[3, 3, 0, 0] as [number, number, number, number]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {visualization.type === 'pie' && (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data} dataKey={yField} nameKey={xField} cx="50%" cy="50%" outerRadius={80} label>
                    {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: isDark ? '#0f172a' : '#fff', border: `1px solid ${gridColor}`, fontSize: 12, borderRadius: 8 }} />
                  <Legend formatter={(v: string) => <span style={{ fontSize: 11, color: textSecondary }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
            {visualization.type === 'counter' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                            height: 120, flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 42, fontWeight: 700, color: '#6366f1' }}>
                  {String(data[0]?.[yField] ?? '—')}
                </span>
              </div>
            )}
            {visualization.type === 'table' && (
              <div style={{ overflowX: 'auto', maxHeight: 224, overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {Object.keys(data[0] ?? {}).map((col) => (
                        <th key={col} style={{
                          textAlign: 'left', color: textSecondary, fontWeight: 500,
                          paddingBottom: 8, paddingRight: 16, whiteSpace: 'nowrap',
                          borderBottom: `1px solid ${border}`,
                        }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 20).map((row, i) => (
                      <tr key={i}>
                        {Object.keys(data[0] ?? {}).map((col) => (
                          <td key={col} style={{
                            padding: '7px 16px 7px 0', color: textPrimary,
                            whiteSpace: 'nowrap', borderBottom: `1px solid ${border}`,
                          }}>
                            {String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Summary text */}
      {summary && (
        <div style={{ padding: '0 16px 12px', fontSize: 13, color: textSecondary, lineHeight: 1.6 }}>
          {summary}
        </div>
      )}

      {/* Thought process (collapsible) */}
      {thoughts.length > 0 && (
        <div style={{ borderTop: `1px solid ${border}` }}>
          <button
            onClick={() => setShowThoughts(!showThoughts)}
            style={{
              width: '100%', padding: '9px 16px', background: 'transparent',
              border: 'none', color: textSecondary, fontSize: 12, cursor: 'pointer',
              textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: 9, display: 'inline-block', transform: showThoughts ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
            Agent reasoning ({thoughts.length} step{thoughts.length !== 1 ? 's' : ''})
          </button>
          {showThoughts && (
            <ol style={{ margin: 0, paddingLeft: 32, paddingBottom: 12, paddingRight: 16 }}>
              {thoughts.map((t, i) => (
                <li key={i} style={{ fontSize: 12, color: textSecondary, lineHeight: 1.6, paddingBottom: 4 }}>
                  {t}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: '8px 16px',
        borderTop: `1px solid ${border}`,
        fontSize: 11,
        color: textSecondary,
        opacity: 0.7,
      }}>
        Powered by Dune Analytics · Mainnet data
      </div>
    </div>
  );
}

export default DuneChartMessage;

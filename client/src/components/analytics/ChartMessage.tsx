import React from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import type { ChartType } from '../../lib/analyticsEngine';

const COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface Props {
  title:       string;
  description: string;
  chartType:   ChartType;
  data:        any[];
  isLoading:   boolean;
  error:       string | null;
  theme:       any;
  isDark:      boolean;
}

export function ChartMessage({ title, description, chartType,
                               data, isLoading, error, theme, isDark }: Props) {
  const bg = theme?.bgCard ?? (isDark ? '#1e293b' : '#ffffff');
  const border = theme?.border ?? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)');
  const textPrimary = theme?.textPrimary ?? (isDark ? '#f1f5f9' : '#0f172a');
  const textSecondary = theme?.textSecondary ?? (isDark ? '#94a3b8' : '#64748b');
  const gridColor = isDark ? '#1f2937' : '#e5e7eb';

  return (
    <div style={{
      width: '100%', maxWidth: 640, borderRadius: 16,
      border: `1px solid ${border}`, background: bg, overflow: 'hidden',
      fontFamily: '"DM Sans", sans-serif',
    }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: textPrimary, margin: 0 }}>{title}</p>
        <p style={{ fontSize: 12, color: textSecondary, margin: '4px 0 0' }}>{description}</p>
      </div>

      <div style={{ padding: 16 }}>
        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                        height: 160, gap: 12, color: textSecondary }}>
            <div style={{
              width: 16, height: 16, border: '2px solid #7c3aed',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <span style={{ fontSize: 13 }}>Querying subgraph...</span>
          </div>
        )}
        {error && !isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                        height: 160, color: '#ef4444', fontSize: 13 }}>
            {error}
          </div>
        )}
        {!isLoading && !error && data.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                        height: 160, color: textSecondary, fontSize: 13 }}>
            No data found for this query.
          </div>
        )}
        {!isLoading && !error && data.length > 0 && (
          <>
            {chartType === 'line'  && <LineChartView  data={data} isDark={isDark} gridColor={gridColor} />}
            {chartType === 'bar'   && <BarChartView   data={data} isDark={isDark} gridColor={gridColor} />}
            {chartType === 'pie'   && <PieChartView   data={data} isDark={isDark} />}
            {chartType === 'table' && <TableView      data={data} isDark={isDark} textPrimary={textPrimary} textSecondary={textSecondary} border={border} />}
            {chartType === 'stat'  && <StatCardView   data={data} isDark={isDark} textPrimary={textPrimary} textSecondary={textSecondary} />}
          </>
        )}
      </div>

      <div style={{ padding: '8px 16px', borderTop: `1px solid ${border}`,
                    fontSize: 11, color: textSecondary, opacity: 0.7 }}>
        Powered by The Graph - Live on-chain data
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function LineChartView({ data, isDark, gridColor }: { data: any[]; isDark: boolean; gridColor: string }) {
  const keys = data.length > 0
    ? Object.keys(data[0]).filter(k => k !== 'name' && k !== 'timestamp' && k !== 'hourStartUnix' && k !== 'dayStartUnix')
    : [];
  const tickFill = isDark ? '#6b7280' : '#9ca3af';
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="name" tick={{ fill: tickFill, fontSize: 11 }} />
        <YAxis tick={{ fill: tickFill, fontSize: 11 }} />
        <Tooltip contentStyle={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${gridColor}`, color: isDark ? '#fff' : '#000', fontSize: 12, borderRadius: 8 }} />
        {keys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function BarChartView({ data, isDark, gridColor }: { data: any[]; isDark: boolean; gridColor: string }) {
  const keys = data.length > 0
    ? Object.keys(data[0]).filter(k => k !== 'name')
    : [];
  const tickFill = isDark ? '#6b7280' : '#9ca3af';
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="name" tick={{ fill: tickFill, fontSize: 11 }} />
        <YAxis tick={{ fill: tickFill, fontSize: 11 }} />
        <Tooltip contentStyle={{ background: isDark ? '#111827' : '#fff', border: `1px solid ${gridColor}`, color: isDark ? '#fff' : '#000', fontSize: 12, borderRadius: 8 }} />
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0] as any} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieChartView({ data, isDark }: { data: any[]; isDark: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
             dataKey="value" nameKey="name" paddingAngle={3}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: isDark ? '#111827' : '#fff', border: '1px solid #374151', color: isDark ? '#fff' : '#000', fontSize: 12, borderRadius: 8 }} />
        <Legend formatter={(v: string) => <span style={{ fontSize: 11, color: isDark ? '#9ca3af' : '#6b7280' }}>{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function TableView({ data, isDark, textPrimary, textSecondary, border }: { data: any[]; isDark: boolean; textPrimary: string; textSecondary: string; border: string }) {
  const cols = data.length > 0 ? Object.keys(data[0]) : [];
  const rows = data.slice(0, 20);
  return (
    <div style={{ overflowX: 'auto', maxHeight: 224, overflowY: 'auto' }}>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr>{cols.map(c => (
            <th key={c} style={{ textAlign: 'left', color: textSecondary, fontWeight: 500,
                                 paddingBottom: 8, paddingRight: 16, whiteSpace: 'nowrap',
                                 textTransform: 'capitalize', borderBottom: `1px solid ${border}` }}>
              {c}
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>{cols.map(c => (
              <td key={c} style={{ padding: '8px 16px 8px 0', color: textPrimary,
                                   whiteSpace: 'nowrap', fontFamily: 'SF Mono, Monaco, monospace',
                                   maxWidth: 128, overflow: 'hidden', textOverflow: 'ellipsis',
                                   borderBottom: `1px solid ${border}` }}>
                {String(row[c] ?? '')}
              </td>
            ))}</tr>
          ))}
        </tbody>
      </table>
      {data.length > 20 && (
        <p style={{ fontSize: 11, color: textSecondary, marginTop: 8 }}>
          Showing 20 of {data.length} results
        </p>
      )}
    </div>
  );
}

function StatCardView({ data, isDark, textPrimary, textSecondary }: { data: any[]; isDark: boolean; textPrimary: string; textSecondary: string }) {
  const stats = Array.isArray(data) ? data : Object.entries(data[0] ?? {});
  const bgCard = isDark ? 'rgba(139, 92, 246, 0.08)' : 'rgba(139, 92, 246, 0.05)';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
      {(stats as any[]).slice(0, 6).map((item: any, i: number) => {
        const label = item.name ?? item[0] ?? '';
        const val = item.value ?? item[1] ?? '';
        return (
          <div key={i} style={{ padding: 12, background: bgCard, borderRadius: 12 }}>
            <p style={{ fontSize: 11, color: textSecondary, margin: '0 0 4px', textTransform: 'capitalize' }}>{label}</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: textPrimary, margin: 0 }}>{String(val)}</p>
          </div>
        );
      })}
    </div>
  );
}

export default ChartMessage;

/**
 * AnalyticsDashboard.tsx
 * Internal analytics view showing key Mantua platform metrics.
 * Shows: unique wallets, voice %, hook adoption %, daily event chart.
 * Only rendered in development or for admin addresses.
 */

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Mic, Zap, BarChart2, RefreshCw } from 'lucide-react';
import { SkeletonStat, SkeletonBox } from '../ui/skeleton';
import { ErrorState }               from '../ui/ErrorState';
import { parseError }               from '../../lib/errorMessages';

interface Summary {
  period: string;
  metrics: {
    uniqueWallets:      number;
    voiceCommandPct:    string;
    hookAdoptionPct:    string;
    totalSwaps:         number;
    hookSwaps:          number;
    totalVoiceCommands: number;
    totalTextCommands:  number;
  };
  dailyEvents: Array<{ date: string; event: string; count: number }>;
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Users; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="p-5 bg-gray-900 border border-gray-800 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export function AnalyticsDashboard() {
  const [data,    setData]    = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [days,    setDays]    = useState(30);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/analytics/summary?days=${days}`, {
        headers: { 'x-analytics-secret': (import.meta as any).env?.VITE_ANALYTICS_SECRET ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError(parseError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [days]);

  const chartData = data
    ? Object.entries(
        data.dailyEvents.reduce((acc, e) => {
          acc[e.date] = (acc[e.date] ?? 0) + +e.count;
          return acc;
        }, {} as Record<string, number>)
      ).map(([date, count]) => ({ date: date.slice(5), count }))
    : [];

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-y-auto px-6 pt-5 pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">Platform metrics · {days}-day window</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                days === d ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {d}d
            </button>
          ))}
          <button onClick={load} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 bg-gray-900 border border-gray-800 rounded-xl"><SkeletonStat /></div>
          ))
        ) : data ? (
          <>
            <StatCard icon={Users}    label="Unique Wallets"  value={String(data.metrics.uniqueWallets)}  sub={`Last ${days} days`} color="text-purple-400" />
            <StatCard icon={Mic}      label="Voice Commands"  value={`${data.metrics.voiceCommandPct}%`} sub={`${data.metrics.totalVoiceCommands} voice / ${data.metrics.totalTextCommands} text`} color="text-blue-400" />
            <StatCard icon={Zap}      label="Hook Adoption"   value={`${data.metrics.hookAdoptionPct}%`} sub={`${data.metrics.hookSwaps} of ${data.metrics.totalSwaps} swaps`} color="text-emerald-400" />
            <StatCard icon={BarChart2} label="Total Swaps"    value={String(data.metrics.totalSwaps)}    sub="All hook types" color="text-orange-400" />
          </>
        ) : null}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Events Over Time</h3>
        {loading ? (
          <SkeletonBox className="w-full h-40" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No events yet in this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#e5e7eb', fontSize: 11 }}
                itemStyle={{ color: '#a78bfa', fontSize: 11 }}
              />
              <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

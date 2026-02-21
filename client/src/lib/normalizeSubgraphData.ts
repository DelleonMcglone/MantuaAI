import type { ChartType } from './analyticsEngine';

export interface ChartDataPoint {
  name:  string;
  [key: string]: string | number;
}

export function normalizeForChart(
  raw:       any,
  chartType: ChartType
): ChartDataPoint[] {
  if (!raw || typeof raw !== 'object') return [];

  const key  = Object.keys(raw).find(k => Array.isArray(raw[k]));
  const rows = key ? raw[key] : [];

  if (rows.length === 0) {
    if (raw.protocols?.[0]) return normalizeProtocol(raw.protocols[0]);
    return [];
  }

  const first = rows[0];

  if ('hourStartUnix'  in first) return normalizeHourData(rows);
  if ('dayStartUnix'   in first) return normalizeDayData(rows);
  if ('apyBps'         in first) return normalizeVaults(rows);
  if ('amountUSD'      in first && 'txHash' in first) return normalizeSwaps(rows);
  if ('tvlUSD'         in first) return normalizePools(rows);
  if ('liquidity'      in first) return normalizePositions(rows);
  if ('assets'         in first) return normalizeDeposits(rows);

  return rows.map((r: any, i: number) => ({ name: String(i + 1), ...r }));
}

function normalizeHourData(rows: any[]): ChartDataPoint[] {
  return rows.map(r => ({
    name:      formatTimestamp(Number(r.hourStartUnix), 'hour'),
    volumeUSD: parseFloat(r.volumeUSD ?? '0'),
    txCount:   Number(r.txCount ?? 0),
  }));
}

function normalizeDayData(rows: any[]): ChartDataPoint[] {
  return rows.map(r => ({
    name:        formatTimestamp(Number(r.dayStartUnix), 'day'),
    totalAssets: parseFloat(r.totalAssets ?? '0'),
    deposits:    parseFloat(r.dailyDeposits ?? '0'),
    withdrawals: parseFloat(r.dailyWithdrawals ?? '0'),
  }));
}

function normalizeVaults(rows: any[]): ChartDataPoint[] {
  return rows.map(r => ({
    name:   r.symbol ?? r.name ?? 'Vault',
    value:  parseFloat(r.totalAssets ?? '0'),
    apy:    Number(r.apyBps ?? 0) / 100,
    shares: parseFloat(r.totalShares ?? '0'),
  }));
}

function normalizeSwaps(rows: any[]): ChartDataPoint[] {
  return rows.map(r => ({
    name: formatTimestamp(Number(r.timestamp), 'time'),
    usd:  parseFloat(r.amountUSD ?? '0'),
    pair: `${r.pool?.token0?.symbol ?? '?'}/${r.pool?.token1?.symbol ?? '?'}`,
    tx:   (r.txHash ?? '').slice(0, 10) + '...',
  }));
}

function normalizePools(rows: any[]): ChartDataPoint[] {
  return rows.map(r => ({
    name:   `${r.token0?.symbol ?? '?'}/${r.token1?.symbol ?? '?'}`,
    tvl:    parseFloat(r.tvlUSD  ?? '0'),
    volume: parseFloat(r.volumeUSD ?? '0'),
    fees:   parseFloat(r.feesUSD ?? '0'),
    value:  parseFloat(r.tvlUSD  ?? '0'),
  }));
}

function normalizePositions(rows: any[]): ChartDataPoint[] {
  return rows.map(r => ({
    name:   `${r.pool?.token0?.symbol ?? '?'}/${r.pool?.token1?.symbol ?? '?'}`,
    token0: parseFloat(r.depositedToken0 ?? '0'),
    token1: parseFloat(r.depositedToken1 ?? '0'),
    value:  parseFloat(r.depositedToken0 ?? '0'),
  }));
}

function normalizeDeposits(rows: any[]): ChartDataPoint[] {
  return rows.map(r => ({
    name:   formatTimestamp(Number(r.timestamp), 'day'),
    amount: parseFloat(r.assets ?? r.amount ?? '0'),
    vault:  r.vault?.symbol ?? '',
    value:  parseFloat(r.assets ?? '0'),
  }));
}

function normalizeProtocol(p: any): ChartDataPoint[] {
  return Object.entries(p)
    .filter(([k]) => k !== '__typename' && k !== 'id')
    .map(([k, v]) => ({
      name:  formatKey(k),
      value: String(v),
    }));
}

function formatTimestamp(ts: number, precision: 'hour' | 'day' | 'time'): string {
  const d = new Date(ts * 1000);
  if (precision === 'time') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (precision === 'hour') return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatKey(k: string): string {
  return k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

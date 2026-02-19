export type ChartType = 'line' | 'bar' | 'pie' | 'table' | 'stat';

export interface AnalyticsQuery {
  graphql:     string;
  chartType:   ChartType;
  title:       string;
  description: string;
  variables:   Record<string, string>;
}

const SCHEMA_CONTEXT = `
You are a GraphQL query generator for the Mantua.AI subgraph.
Available entities and fields:

Protocol: totalVolumeUSD, totalFeesUSD, totalTvlUSD, totalSwaps, totalPools,
          totalVaultDeposits, totalBetsUSD

Swap: id, pool{token0{symbol} token1{symbol}}, amountUSD, timestamp, txHash

SwapHourData: pool{id token0{symbol} token1{symbol}}, hourStartUnix,
              volumeUSD, volumeToken0, volumeToken1, txCount

Pool: id, token0{symbol name}, token1{symbol name}, feeTier, tvlUSD,
      volumeUSD, feesUSD, txCount, createdAt

Position: id, owner, pool{token0{symbol} token1{symbol}}, liquidity,
          tickLower, tickUpper, depositedToken0, depositedToken1

Vault: id, name, symbol, strategy, totalAssets, totalShares, apyBps

VaultDeposit: vault{name symbol}, sender, owner, assets, shares, timestamp

VaultDayData: vault{name}, dayStartUnix, totalAssets, dailyDeposits,
              dailyWithdrawals, apyBps

PredictionMarket: id, question, category, resolved, outcome,
                  totalYesShares, totalNoShares, createdAt

PredictionBet: market{question}, user, isYes, amount, timestamp

PredictionClaim: market{question}, user, payout, timestamp

Filtering: where:{field_gte: $value, field_lte: $value}
Sorting: orderBy: fieldName, orderDirection: asc|desc
Pagination: first: N, skip: N
Timestamps are Unix seconds (BigInt as string in variables)

Return ONLY a JSON object with these exact fields:
{
  "graphql": "{ ... }",
  "chartType": "line|bar|pie|table|stat",
  "title": "Human readable title",
  "description": "One sentence description",
  "variables": {}
}
Choose chartType based on:
- line: time-series data (hourly/daily trends)
- bar: comparison across categories (pools, markets, vaults)
- pie: distribution/breakdown (shares, allocations)
- table: list of records, user-specific data
- stat: single aggregate number
`;

export async function generateAnalyticsQuery(
  userMessage: string
): Promise<AnalyticsQuery | null> {
  try {
    const response = await fetch('/api/analytics/generate-query', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage, schemaContext: SCHEMA_CONTEXT }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data as AnalyticsQuery;
  } catch (err) {
    console.error('[AnalyticsEngine] Failed to generate query:', err);
    return null;
  }
}

export function isAnalyticsQuery(message: string): boolean {
  const msg = message.toLowerCase();
  const analyticsKeywords = [
    'show me', 'chart', 'graph', 'plot', 'volume over', 'tvl over',
    'stats for', 'analytics', 'history of', 'over time', 'breakdown',
    'distribution', 'how much total', 'how many total', 'total swaps',
    'total volume', 'trend', 'compare pools', 'top pools', 'top vaults',
    'my positions', 'my deposits', 'leaderboard', 'vault tvl',
    'swap volume', 'prediction stats', 'market stats',
    'protocol stats', 'on-chain', 'onchain', 'subgraph',
  ];
  const tradeKeywords = ['swap ', 'buy ', 'sell ', 'deposit ', 'withdraw ', 'bet '];

  const hasAnalytics = analyticsKeywords.some(k => msg.includes(k));
  const hasTrade     = tradeKeywords.some(k => msg.startsWith(k));
  return hasAnalytics && !hasTrade;
}

/**
 * duneQueries.ts
 * Curated Dune query IDs + raw DuneSQL templates for common on-chain data requests.
 * Query IDs are public Dune queries verified to work on the free tier.
 * SQL templates run via the Dune CLI `run-sql` capability.
 */

export interface DuneQueryConfig {
  id: number;
  name: string;
  description: string;
  keywords: string[];
  parameters?: Record<string, string>;
}

// ── Pre-built public queries (cached results, fastest) ─────────────────────

export const DUNE_QUERIES: Record<string, DuneQueryConfig> = {
  'nft-marketplace-rankings': {
    id: 1252207,
    name: 'NFT Marketplace Rankings',
    description: 'Top NFT marketplaces by volume (24h, 7d, all-time)',
    keywords: ['nft', 'opensea', 'blur', 'marketplace', 'collectible'],
  },
  'dex-volume': {
    id: 3374572,
    name: 'DEX Volume Overview',
    description: 'Decentralized exchange swap volume by protocol',
    keywords: ['dex', 'volume', 'swap volume', 'exchange', 'defi volume'],
  },
  'uniswap-v4-base': {
    id: 4559580,
    name: 'Uniswap v4 Activity on Base',
    description: 'Uniswap v4 pool and swap activity on Base chain',
    keywords: ['uniswap', 'v4', 'base', 'pool', 'hook', 'uniswap v4'],
  },
  'eth-gas': {
    id: 3468667,
    name: 'ETH Gas Analytics',
    description: 'Ethereum gas fees and transaction costs over time',
    keywords: ['gas', 'gwei', 'fee', 'eth gas', 'transaction cost'],
  },
};

// ── Raw DuneSQL templates (run via run-sql, more flexible) ─────────────────

export interface DuneSQLTemplate {
  name: string;
  description: string;
  keywords: string[];
  sql: string;
  /** Optional parameter placeholders — caller fills {{param}} before execution */
  params?: string[];
}

export const DUNE_SQL_TEMPLATES: Record<string, DuneSQLTemplate> = {
  'uniswap-pools-base': {
    name: 'Uniswap Pools on Base',
    description: 'Active Uniswap v3/v4 pools on Base with volume and TVL',
    keywords: ['uniswap pools', 'base pools', 'pool tvl', 'pool volume'],
    sql: `
      SELECT
        pool_address,
        token0_symbol,
        token1_symbol,
        fee_tier,
        tvl_usd,
        volume_usd_24h
      FROM dex.pools
      WHERE blockchain = 'base'
        AND project = 'uniswap'
      ORDER BY tvl_usd DESC
      LIMIT 25
    `,
  },
  'token-price-history': {
    name: 'Token Price History',
    description: 'Daily price history for a token over the last 30 days',
    keywords: ['price history', 'token price', 'price chart', 'historical price'],
    sql: `
      SELECT
        date_trunc('day', minute) AS day,
        symbol,
        AVG(price) AS avg_price,
        MIN(price) AS low,
        MAX(price) AS high
      FROM prices.usd
      WHERE symbol = '{{symbol}}'
        AND minute > NOW() - INTERVAL '30' DAY
      GROUP BY 1, 2
      ORDER BY 1
    `,
    params: ['symbol'],
  },
  'wallet-activity': {
    name: 'Wallet Activity',
    description: 'Recent transactions and token transfers for a wallet address',
    keywords: ['wallet', 'transactions', 'activity', 'address', 'wallet history'],
    sql: `
      SELECT
        block_time,
        hash AS tx_hash,
        "from",
        "to",
        value / 1e18 AS eth_value,
        gas_used,
        gas_price / 1e9 AS gas_gwei
      FROM ethereum.transactions
      WHERE "from" = CAST('{{address}}' AS varbinary)
         OR "to" = CAST('{{address}}' AS varbinary)
      ORDER BY block_time DESC
      LIMIT 20
    `,
    params: ['address'],
  },
  'defi-tvl-ranking': {
    name: 'DeFi TVL Rankings',
    description: 'Top DeFi protocols ranked by total value locked',
    keywords: ['tvl', 'defi', 'total value locked', 'protocol ranking', 'defi ranking'],
    sql: `
      SELECT
        project,
        blockchain,
        SUM(tvl_usd) AS total_tvl
      FROM dex.pools
      GROUP BY 1, 2
      ORDER BY total_tvl DESC
      LIMIT 20
    `,
  },
  'stablecoin-volume': {
    name: 'Stablecoin Trading Volume',
    description: 'USDC, USDT, EURC swap volume across DEXes',
    keywords: ['stablecoin', 'usdc volume', 'usdt volume', 'eurc', 'stable volume'],
    sql: `
      SELECT
        date_trunc('day', block_time) AS day,
        token_bought_symbol,
        token_sold_symbol,
        SUM(amount_usd) AS volume_usd,
        COUNT(*) AS trade_count
      FROM dex.trades
      WHERE (token_bought_symbol IN ('USDC', 'USDT', 'EURC')
          OR token_sold_symbol IN ('USDC', 'USDT', 'EURC'))
        AND block_time > NOW() - INTERVAL '7' DAY
      GROUP BY 1, 2, 3
      ORDER BY volume_usd DESC
      LIMIT 30
    `,
  },
  'gas-trends': {
    name: 'Gas Price Trends',
    description: 'Hourly average gas prices on Ethereum over the last 24 hours',
    keywords: ['gas trend', 'gas price', 'gwei', 'gas cost', 'ethereum gas'],
    sql: `
      SELECT
        date_trunc('hour', block_time) AS hour,
        AVG(gas_price) / 1e9 AS avg_gas_gwei,
        APPROX_PERCENTILE(gas_price / 1e9, 0.5) AS median_gas_gwei,
        COUNT(*) AS tx_count
      FROM ethereum.transactions
      WHERE block_time > NOW() - INTERVAL '24' HOUR
      GROUP BY 1
      ORDER BY 1
    `,
  },
};

/**
 * Match a natural language message to a pre-built Dune query.
 * Returns null if no match — caller should try SQL templates next.
 */
export function matchDuneQuery(message: string): DuneQueryConfig | null {
  const lower = message.toLowerCase();
  for (const query of Object.values(DUNE_QUERIES)) {
    if (query.keywords.some(kw => lower.includes(kw))) {
      return query;
    }
  }
  return null;
}

/**
 * Match a message to a DuneSQL template for raw SQL execution.
 * Returns null if no match.
 */
export function matchSQLTemplate(message: string): DuneSQLTemplate | null {
  const lower = message.toLowerCase();
  for (const tmpl of Object.values(DUNE_SQL_TEMPLATES)) {
    if (tmpl.keywords.some(kw => lower.includes(kw))) {
      return tmpl;
    }
  }
  return null;
}

/**
 * Fill template parameters from the user message.
 * Looks for 0x addresses and token symbols.
 */
export function fillTemplateParams(sql: string, message: string): string {
  let filled = sql;

  // Extract wallet address
  const addrMatch = /0x[a-fA-F0-9]{40}/i.exec(message);
  if (addrMatch) {
    filled = filled.replace(/\{\{address\}\}/g, addrMatch[0]);
  }

  // Extract token symbol
  const symbolMatch = /\b(ETH|BTC|USDC|USDT|EURC|LINK|UNI|AAVE|DAI|WETH|WBTC)\b/i.exec(message);
  if (symbolMatch) {
    filled = filled.replace(/\{\{symbol\}\}/g, symbolMatch[1].toUpperCase());
  }

  return filled;
}

/** Returns all curated queries as an array (for suggestions UI). */
export function getAllQueries(): DuneQueryConfig[] {
  return Object.values(DUNE_QUERIES);
}

/** Returns all SQL templates as an array. */
export function getAllSQLTemplates(): DuneSQLTemplate[] {
  return Object.values(DUNE_SQL_TEMPLATES);
}

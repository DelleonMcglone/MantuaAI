/**
 * duneQueries.ts
 * Curated Dune query IDs for common on-chain data requests.
 * Query IDs are public Dune queries verified to work on the free tier.
 */

export interface DuneQueryConfig {
  id: number;
  name: string;
  description: string;
  keywords: string[];
  parameters?: Record<string, string>;
}

// Public Dune queries — verified working on free tier
// Browse more at https://dune.com/queries
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
    keywords: ['dex', 'volume', 'swap', 'exchange', 'defi'],
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

/**
 * Match a natural language message to a pre-built Dune query.
 * Returns null if no match — caller should handle gracefully.
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

/** Returns all curated queries as an array (for suggestions UI). */
export function getAllQueries(): DuneQueryConfig[] {
  return Object.values(DUNE_QUERIES);
}

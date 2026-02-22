/**
 * Token metadata for external integrations.
 * Single source of truth for all token definitions, CoinGecko IDs, and chart data.
 * Tokens with coingeckoId: null fall back to a flat-line chart with a [Price Unavailable] badge.
 */

export type TokenCategory = 'stables' | 'rwas' | 'lsts' | 'wrapped' | 'native';

export interface TokenDefinition {
  symbol: string;
  name: string;
  category: TokenCategory;
  coingeckoId: string | null;
  decimals: number;
  color: string;
  logoURI: string;
  icon: string;
}

// All logoURIs use the CoinGecko CDN (small = 24px).
export const TOKEN_LIST: TokenDefinition[] = [
  // STABLES
  { symbol: 'mUSDC', name: 'Mantua USDC', category: 'stables', coingeckoId: 'usd-coin', decimals: 6, color: '#2775CA', logoURI: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png', icon: '$' },
  { symbol: 'mUSDT', name: 'Mantua USDT', category: 'stables', coingeckoId: 'tether', decimals: 6, color: '#26A17B', logoURI: 'https://assets.coingecko.com/coins/images/325/small/Tether.png', icon: '$' },
  { symbol: 'mUSDE', name: 'Mantua USDe', category: 'stables', coingeckoId: 'ethena-usde', decimals: 18, color: '#8B5CF6', logoURI: 'https://assets.coingecko.com/coins/images/33613/small/usde.png', icon: '$' },
  { symbol: 'mUSDS', name: 'Mantua USDS', category: 'stables', coingeckoId: 'usds', decimals: 18, color: '#F59E0B', logoURI: 'https://assets.coingecko.com/coins/images/39926/small/usds.png', icon: '$' },
  // RWAs
  { symbol: 'mBUIDL', name: 'Mantua BUIDL', category: 'rwas', coingeckoId: null, decimals: 6, color: '#1F2937', logoURI: 'https://assets.coingecko.com/coins/images/34801/small/buidl.png', icon: 'B' },
  { symbol: 'mUSDY', name: 'Mantua USDY', category: 'rwas', coingeckoId: null, decimals: 18, color: '#3B82F6', logoURI: 'https://assets.coingecko.com/coins/images/31289/small/usdy.png', icon: '$' },
  // LSTs
  { symbol: 'mstETH', name: 'Mantua stETH', category: 'lsts', coingeckoId: 'staked-ether', decimals: 18, color: '#00A3FF', logoURI: 'https://assets.coingecko.com/coins/images/13442/small/steth_logo.png', icon: 'Ξ' },
  { symbol: 'mcbETH', name: 'Mantua cbETH', category: 'lsts', coingeckoId: 'coinbase-wrapped-staked-eth', decimals: 18, color: '#0052FF', logoURI: 'https://assets.coingecko.com/coins/images/27008/small/cbeth.png', icon: 'Ξ' },
  // WRAPPED
  { symbol: 'mWBTC', name: 'Mantua WBTC', category: 'wrapped', coingeckoId: 'wrapped-bitcoin', decimals: 8, color: '#F7931A', logoURI: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png', icon: '₿' },
  { symbol: 'mWETH', name: 'Mantua WETH', category: 'wrapped', coingeckoId: 'weth', decimals: 18, color: '#627EEA', logoURI: 'https://assets.coingecko.com/coins/images/2518/small/weth.png', icon: 'Ξ' },
  { symbol: 'mWSOL', name: 'Mantua WSOL', category: 'wrapped', coingeckoId: 'wrapped-solana', decimals: 9, color: '#9945FF', logoURI: 'https://assets.coingecko.com/coins/images/21629/small/solana.png', icon: '◎' },
  { symbol: 'mBTC', name: 'Mantua BTC', category: 'wrapped', coingeckoId: 'bitcoin', decimals: 8, color: '#F7931A', logoURI: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png', icon: '₿' },
];

// Quick lookup by symbol
export const TOKEN_MAP: Record<string, TokenDefinition> = Object.fromEntries(
  TOKEN_LIST.map(t => [t.symbol, t])
);

// CoinGecko ID lookup for chart/price fetching — includes native ETH
export const COINGECKO_IDS: Record<string, string> = {
  ETH:    'ethereum',
  mUSDC:  'usd-coin',
  mUSDT:  'tether',
  mUSDE:  'ethena-usde',
  mUSDS:  'usds',
  mstETH: 'staked-ether',
  mcbETH: 'coinbase-wrapped-staked-eth',
  mWBTC:  'wrapped-bitcoin',
  mWETH:  'weth',
  mWSOL:  'wrapped-solana',
  mBTC:   'bitcoin',
};

/** Days parameter for each time range tab */
export const COINGECKO_DAYS: Record<string, string> = {
  '1D': '1',
  '7D': '7',
  '30D': '30',
};

/** Cache TTL: 60 seconds */
export const PRICE_CACHE_TTL_MS = 60_000;

// ── NATIVE ETH ────────────────────────────────────────────────────────────────
// Native ETH appears first in every selector — always enabled regardless of chain
export const NATIVE_ETH: TokenDefinition & { category: 'native' } = {
  symbol: 'ETH',
  name: 'Ethereum',
  category: 'native' as const,
  coingeckoId: 'ethereum',
  decimals: 18,
  color: '#627EEA',
  logoURI: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  icon: 'Ξ',
};

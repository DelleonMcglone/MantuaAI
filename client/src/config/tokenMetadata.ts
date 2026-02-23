export type TokenCategory = 'stables' | 'native';

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

export const TOKEN_LIST: TokenDefinition[] = [
  { symbol: 'mUSDC', name: 'Mantua USDC', category: 'stables', coingeckoId: 'usd-coin', decimals: 6, color: '#2775CA', logoURI: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png', icon: '$' },
  { symbol: 'mUSDT', name: 'Mantua USDT', category: 'stables', coingeckoId: 'tether', decimals: 6, color: '#26A17B', logoURI: 'https://assets.coingecko.com/coins/images/325/small/Tether.png', icon: '$' },
  { symbol: 'mUSDE', name: 'Mantua USDe', category: 'stables', coingeckoId: 'ethena-usde', decimals: 18, color: '#8B5CF6', logoURI: 'https://assets.coingecko.com/coins/images/33613/small/usde.png', icon: '$' },
  { symbol: 'mUSDS', name: 'Mantua USDS', category: 'stables', coingeckoId: 'usds', decimals: 18, color: '#F59E0B', logoURI: 'https://assets.coingecko.com/coins/images/39926/small/usds.png', icon: '$' },
];

export const TOKEN_MAP: Record<string, TokenDefinition> = Object.fromEntries(
  TOKEN_LIST.map(t => [t.symbol, t])
);

export const COINGECKO_IDS: Record<string, string> = {
  ETH:    'ethereum',
  mUSDC:  'usd-coin',
  mUSDT:  'tether',
  mUSDE:  'ethena-usde',
  mUSDS:  'usds',
};

export const COINGECKO_DAYS: Record<string, string> = {
  '1D': '1',
  '7D': '7',
  '30D': '30',
};

export const PRICE_CACHE_TTL_MS = 60_000;

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

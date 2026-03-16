export interface Token {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  coingeckoId: string;
  isNative: boolean;
  chainId: number;
}

export const NATIVE_ETH: Token = {
  symbol: 'ETH',
  name: 'Ethereum',
  address: '0x0000000000000000000000000000000000000000',
  decimals: 18,
  chainId: 84532,
  logoURI: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  coingeckoId: 'ethereum',
  isNative: true,
};

export const BASE_SEPOLIA_ERC20_TOKENS: Token[] = [
  {
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    address: '0xcbb7c0006f23900c38eb856149f799620fcb8a4a',
    decimals: 8,
    chainId: 84532,
    logoURI: 'https://assets.coingecko.com/coins/images/40143/small/cbbtc.webp',
    coingeckoId: 'coinbase-wrapped-btc',
    isNative: false,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    decimals: 6,
    chainId: 84532,
    logoURI: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
    coingeckoId: 'usd-coin',
    isNative: false,
  },
  {
    symbol: 'EURC',
    name: 'Euro Coin',
    address: '0x808456652fdb597867f38412077A9182bf77359F',
    decimals: 6,
    chainId: 84532,
    logoURI: 'https://assets.coingecko.com/coins/images/26045/small/euro-coin.png',
    coingeckoId: 'euro-coin',
    isNative: false,
  },
];

export const CHAIN_IDS = {
  BASE_SEPOLIA: 84532,
} as const;

export function getNativeToken(_chainId: number): Token {
  return NATIVE_ETH;
}

export function getERC20Tokens(_chainId: number): Token[] {
  return BASE_SEPOLIA_ERC20_TOKENS;
}

export function getTokensForChain(chainId: number): Token[] {
  const native = getNativeToken(chainId);
  const erc20s = getERC20Tokens(chainId);
  return [native, ...erc20s];
}

export const ERC20_TOKENS: Token[] = BASE_SEPOLIA_ERC20_TOKENS;

export const SUPPORTED_TOKENS: Token[] = [NATIVE_ETH, ...BASE_SEPOLIA_ERC20_TOKENS];

export const ALL_CHAIN_TOKENS: Token[] = SUPPORTED_TOKENS;

export const MOCK_TOKENS: Token[] = SUPPORTED_TOKENS;
export const ALL_TOKENS: Token[] = SUPPORTED_TOKENS;
export const POPULAR_TOKENS: Token[] = SUPPORTED_TOKENS;
export const STABLECOINS: Token[] = BASE_SEPOLIA_ERC20_TOKENS.filter(
  t => t.symbol === 'USDC' || t.symbol === 'EURC'
);

export const MOCK_TOKEN_FACTORY: `0x${string}` = '0x0000000000000000000000000000000000000000';

export type TokenSymbol = 'ETH' | 'cbBTC' | 'USDC' | 'EURC';

export const TOKEN_BY_SYMBOL: Record<string, Token> = Object.fromEntries(
  SUPPORTED_TOKENS.map(t => [t.symbol, t])
);

export const TOKEN_BY_ADDRESS: Record<string, Token> = Object.fromEntries(
  SUPPORTED_TOKENS.map(t => [t.address.toLowerCase(), t])
);

export function getTokenBySymbol(symbol: string): Token | undefined {
  return TOKEN_BY_SYMBOL[symbol] ?? SUPPORTED_TOKENS.find(
    t => t.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

export function getTokenByAddress(address: `0x${string}`): Token | undefined {
  return TOKEN_BY_ADDRESS[address.toLowerCase()];
}

export function isNativeToken(address: `0x${string}`): boolean {
  return address === '0x0000000000000000000000000000000000000000' ||
    address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
}

export type TokenCategory = 'all' | 'stablecoins' | 'native';

export function getTokensByCategory(category: TokenCategory): Token[] {
  switch (category) {
    case 'stablecoins': return STABLECOINS;
    case 'native': return [NATIVE_ETH];
    case 'all':
    default: return SUPPORTED_TOKENS;
  }
}

export function getCategoryDisplayName(category: TokenCategory): string {
  switch (category) {
    case 'stablecoins': return 'Stablecoins';
    case 'native': return 'Native';
    case 'all':
    default: return 'All Tokens';
  }
}

export const COINGECKO_IDS: Record<string, string> = Object.fromEntries(
  SUPPORTED_TOKENS.map(t => [t.symbol, t.coingeckoId])
);

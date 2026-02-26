export interface Token {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  coingeckoId: string;
  isNative: boolean;
  chainId: 84532;
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

export const STABLECOINS: Token[] = [
  {
    symbol: 'mUSDC',
    name: 'Mock USD Coin',
    address: '0x3365571b822a54c01816bC75b586317F4c1B3E47',
    decimals: 6,
    chainId: 84532,
    logoURI: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
    coingeckoId: 'usd-coin',
    isNative: false,
  },
  {
    symbol: 'mUSDT',
    name: 'Mock Tether',
    address: '0xB85e6FDaB14EAf2fEB9c59BceB97830b98572a2e',
    decimals: 6,
    chainId: 84532,
    logoURI: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
    coingeckoId: 'tether',
    isNative: false,
  },
  {
    symbol: 'mUSDE',
    name: 'Mock USDe',
    address: '0x36048415ecb7Ce82F5523adDCe0e56a37FE963b4',
    decimals: 18,
    chainId: 84532,
    logoURI: 'https://assets.coingecko.com/coins/images/33613/small/usde.png',
    coingeckoId: 'ethena-usde',
    isNative: false,
  },
  {
    symbol: 'mUSDS',
    name: 'Mock USDS',
    address: '0x5aDd6F9167E90A5d211C03Ee8f224108e3b8DC73',
    decimals: 18,
    chainId: 84532,
    logoURI: 'https://assets.coingecko.com/coins/images/39926/small/usds.png',
    coingeckoId: 'usds',
    isNative: false,
  },
];

export const SUPPORTED_TOKENS: Token[] = [NATIVE_ETH, ...STABLECOINS];

export const MOCK_TOKENS: Token[] = SUPPORTED_TOKENS;

export const ALL_TOKENS: Token[] = SUPPORTED_TOKENS;

export const POPULAR_TOKENS: Token[] = SUPPORTED_TOKENS;

export const MOCK_TOKEN_FACTORY: `0x${string}` = '0x0000000000000000000000000000000000000000';

export type TokenSymbol = 'ETH' | 'mUSDC' | 'mUSDT' | 'mUSDE' | 'mUSDS';

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

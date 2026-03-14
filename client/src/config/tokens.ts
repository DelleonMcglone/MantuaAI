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

// ─── Base Sepolia (84532) ───────────────────────────────────────────────────

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
    address: '0xcbB7C0006F23900c38EB856149F799620fcb8A4a',
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
    // Verified: https://base-sepolia.blockscout.com/token/0x808456652fdb597867f38412077A9182bf77359F
    address: '0x808456652fdb597867f38412077A9182bf77359F',
    decimals: 6,
    chainId: 84532,
    logoURI: 'https://assets.coingecko.com/coins/images/26045/small/euro-coin.png',
    coingeckoId: 'euro-coin',
    isNative: false,
  },
];

// ─── Chain-aware token helpers ──────────────────────────────────────────────

export const CHAIN_IDS = {
  BASE_SEPOLIA: 84532,
} as const;

/** Returns the native ETH token for a given chainId */
export function getNativeToken(chainId: number): Token {
  return NATIVE_ETH; // default Base Sepolia
}

/** Returns ERC20 tokens for a given chainId */
export function getERC20Tokens(chainId: number): Token[] {
  return BASE_SEPOLIA_ERC20_TOKENS; // default Base Sepolia
}

/** Returns all tokens (native + ERC20) for a given chainId */
export function getTokensForChain(chainId: number): Token[] {
  const native = getNativeToken(chainId);
  const erc20s = getERC20Tokens(chainId);
  return [native, ...erc20s];
}

// ─── Legacy exports (default to Base Sepolia) ──────────────────────────────

/** @deprecated Use getERC20Tokens(chainId) for multi-chain support */
export const ERC20_TOKENS: Token[] = BASE_SEPOLIA_ERC20_TOKENS;

export const SUPPORTED_TOKENS: Token[] = [NATIVE_ETH, ...BASE_SEPOLIA_ERC20_TOKENS];

// All tokens across all supported chains — used for icon lookups and display only.
// For actual contract interactions, always use getTokensForChain(chainId).
export const ALL_CHAIN_TOKENS: Token[] = [
  NATIVE_ETH,
  ...BASE_SEPOLIA_ERC20_TOKENS,
];

// Legacy aliases — kept for backward compatibility
export const MOCK_TOKENS: Token[] = SUPPORTED_TOKENS;
export const ALL_TOKENS: Token[] = SUPPORTED_TOKENS;
export const POPULAR_TOKENS: Token[] = SUPPORTED_TOKENS;
export const STABLECOINS: Token[] = BASE_SEPOLIA_ERC20_TOKENS.filter(
  t => t.symbol === 'USDC' || t.symbol === 'EURC'
);

export const MOCK_TOKEN_FACTORY: `0x${string}` = '0x0000000000000000000000000000000000000000';

export type TokenSymbol = 'ETH' | 'cbBTC' | 'USDC' | 'EURC';

export const TOKEN_BY_SYMBOL: Record<string, Token> = Object.fromEntries(
  ALL_CHAIN_TOKENS.map(t => [t.symbol, t])
);

export const TOKEN_BY_ADDRESS: Record<string, Token> = Object.fromEntries(
  ALL_CHAIN_TOKENS.map(t => [t.address.toLowerCase(), t])
);

/**
 * Look up a token by symbol, optionally scoped to a specific chain.
 * When chainId is provided, returns the token for that chain (critical for
 * tokens like USDC/ETH that exist on multiple chains with different addresses).
 * Without chainId, returns the first match across all chains.
 */
export function getTokenBySymbol(symbol: string, chainId?: number): Token | undefined {
  const pool = chainId ? getTokensForChain(chainId) : ALL_CHAIN_TOKENS;
  return pool.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
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

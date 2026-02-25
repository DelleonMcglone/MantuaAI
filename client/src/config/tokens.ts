/**
 * Supported tokens on Base Sepolia — ETH, USDC, cbBTC only.
 */
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

export const SUPPORTED_TOKENS = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    decimals: 18,
    chainId: 84532 as const,
    logoURI: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    coingeckoId: 'ethereum',
    isNative: true,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`,
    decimals: 6,
    chainId: 84532 as const,
    logoURI: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
    coingeckoId: 'usd-coin',
    isNative: false,
  },
  {
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf' as `0x${string}`,
    decimals: 8,
    chainId: 84532 as const,
    logoURI: 'https://assets.coingecko.com/coins/images/40143/small/cbbtc.webp',
    coingeckoId: 'coinbase-wrapped-btc',
    isNative: false,
  },
] satisfies Token[];

export type TokenSymbol = 'ETH' | 'USDC' | 'cbBTC';

export const NATIVE_ETH = SUPPORTED_TOKENS[0];

/** Map symbol → token for O(1) lookup */
export const TOKEN_BY_SYMBOL: Record<string, Token> = Object.fromEntries(
  SUPPORTED_TOKENS.map(t => [t.symbol, t])
);

/** Map address (lowercase) → token for O(1) lookup */
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

/** All tokens — for selectors */
export const ALL_TOKENS: Token[] = SUPPORTED_TOKENS;

/** CoinGecko IDs for price lookups */
export const COINGECKO_IDS: Record<TokenSymbol, string> = {
  ETH: 'ethereum',
  USDC: 'usd-coin',
  cbBTC: 'coinbase-wrapped-btc',
};

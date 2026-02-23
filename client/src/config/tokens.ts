export interface Token {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  category: 'native' | 'stablecoin';
  isMock?: boolean;
  faucetAmount?: string;
}

export const MOCK_TOKEN_ADDRESSES = {
  mUSDC:  "0x3365571b822a54c01816bC75b586317F4c1B3E47" as `0x${string}`,
  mUSDT:  "0xB85e6FDaB14EAf2fEB9c59BceB97830b98572a2e" as `0x${string}`,
  mUSDS:  "0x5aDd6F9167E90A5d211C03Ee8f224108e3b8DC73" as `0x${string}`,
  mUSDE:  "0x36048415ecb7Ce82F5523adDCe0e56a37FE963b4" as `0x${string}`,
};

export const MOCK_TOKEN_FACTORY = "0xaa0D98c815C3003d35E571fD51C65d7F92391883" as `0x${string}`;

export const NATIVE_ETH: Token = {
  address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  symbol: "ETH",
  name: "Ethereum",
  decimals: 18,
  logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  category: 'native',
  isMock: false,
};

export const STABLECOINS: Token[] = [
  {
    address: MOCK_TOKEN_ADDRESSES.mUSDC,
    symbol: "mUSDC",
    name: "Mantua USDC",
    decimals: 6,
    logoURI: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    category: 'stablecoin',
    isMock: true,
    faucetAmount: "1,000",
  },
  {
    address: MOCK_TOKEN_ADDRESSES.mUSDT,
    symbol: "mUSDT",
    name: "Mantua USDT",
    decimals: 6,
    logoURI: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    category: 'stablecoin',
    isMock: true,
    faucetAmount: "1,000",
  },
  {
    address: MOCK_TOKEN_ADDRESSES.mUSDE,
    symbol: "mUSDE",
    name: "Mantua USDe",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/33613/small/usde.png",
    category: 'stablecoin',
    isMock: true,
    faucetAmount: "1,000",
  },
  {
    address: MOCK_TOKEN_ADDRESSES.mUSDS,
    symbol: "mUSDS",
    name: "Mantua USDS",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/39926/small/usds.png",
    category: 'stablecoin',
    isMock: true,
    faucetAmount: "1,000",
  },
];

export const MOCK_TOKENS: Token[] = [...STABLECOINS];

export const ALL_TOKENS: Token[] = [NATIVE_ETH, ...MOCK_TOKENS];

export const POPULAR_TOKENS: Token[] = [
  NATIVE_ETH,
  STABLECOINS[0],
  STABLECOINS[1],
  STABLECOINS[2],
  STABLECOINS[3],
];

export function getTokenBySymbol(symbol: string): Token | undefined {
  return ALL_TOKENS.find((token) => token.symbol.toLowerCase() === symbol.toLowerCase());
}

export function getTokenByAddress(address: `0x${string}`): Token | undefined {
  return ALL_TOKENS.find(
    (token) => token.address.toLowerCase() === address.toLowerCase()
  );
}

export function isNativeToken(address: `0x${string}`): boolean {
  return address.toLowerCase() === NATIVE_ETH.address.toLowerCase();
}

export function getMockTokens(): Token[] {
  return MOCK_TOKENS;
}

export function getTokensByCategory(category: Token['category']): Token[] {
  if (category === 'native') return [NATIVE_ETH];
  if (category === 'stablecoin') return STABLECOINS;
  return [];
}

export function getCategoryDisplayName(category: Token['category']): string {
  const names = {
    native: 'Native',
    stablecoin: 'Stablecoins',
  };
  return names[category];
}

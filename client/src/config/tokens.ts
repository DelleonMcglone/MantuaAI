export interface Token {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  category: 'native' | 'stablecoin' | 'rwa' | 'lst' | 'wrapped';
  isMock?: boolean;
  faucetAmount?: string;
}

// Mock token addresses - DEPLOYED TO BASE SEPOLIA
export const MOCK_TOKEN_ADDRESSES = {
  // Stablecoins
  mUSDC:  "0x3365571b822a54c01816bC75b586317F4c1B3E47" as `0x${string}`,
  mUSDT:  "0xB85e6FDaB14EAf2fEB9c59BceB97830b98572a2e" as `0x${string}`,
  // mDAI address repurposed as mUSDS (renamed token, same contract)
  mUSDS:  "0x5aDd6F9167E90A5d211C03Ee8f224108e3b8DC73" as `0x${string}`,
  mUSDE:  "0x36048415ecb7Ce82F5523adDCe0e56a37FE963b4" as `0x${string}`,

  // Real World Assets
  mUSDY:  "0xb6639242Ba9A4799317C889De4c13314dAC6748D" as `0x${string}`,
  mBUIDL: "0x9f390f689954805A278b104cf5b5F59529cF779D" as `0x${string}`,

  // Liquid Staking Tokens
  mstETH: "0xdECB63D9195f64aA5434C557b462F9a977E6ad01" as `0x${string}`,
  mcbETH: "0x7C04d5ED23b229Cb659dc67dd7BF2D75455e339f" as `0x${string}`,

  // Wrapped Assets
  mWBTC:  "0xcA927D36203DC588C66025B8535beFE9C8413237" as `0x${string}`,
  mWETH:  "0xFf445C40e5a1c88A703fcAC607A80DEd7A1bC129" as `0x${string}`,
  mWSOL:  "0x2CD13A38372a65062BceBD980C1FEEA2355ee6e1" as `0x${string}`,
  mBTC:   "0xA6abc29Cd7F5D193c3B507152fF842f684E139E4" as `0x${string}`,
};

// MantuaFaucet address - DEPLOYED TO BASE SEPOLIA
export const MOCK_TOKEN_FACTORY = "0xaa0D98c815C3003d35E571fD51C65d7F92391883" as `0x${string}`;

// Native ETH (special address used in many protocols)
export const NATIVE_ETH: Token = {
  address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  symbol: "ETH",
  name: "Ethereum",
  decimals: 18,
  logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  category: 'native',
  isMock: false,
};

// Stablecoins (4)
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

// Real World Assets (2)
export const RWA_TOKENS: Token[] = [
  {
    address: MOCK_TOKEN_ADDRESSES.mBUIDL,
    symbol: "mBUIDL",
    name: "Mantua BUIDL",
    decimals: 6,
    logoURI: "https://assets.coingecko.com/coins/images/34801/small/buidl.png",
    category: 'rwa',
    isMock: true,
    faucetAmount: "100",
  },
  {
    address: MOCK_TOKEN_ADDRESSES.mUSDY,
    symbol: "mUSDY",
    name: "Mantua USDY",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/31289/small/usdy.png",
    category: 'rwa',
    isMock: true,
    faucetAmount: "100",
  },
];

// Liquid Staking Tokens (2)
export const LST_TOKENS: Token[] = [
  {
    address: MOCK_TOKEN_ADDRESSES.mstETH,
    symbol: "mstETH",
    name: "Mantua stETH",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/13442/small/steth_logo.png",
    category: 'lst',
    isMock: true,
    faucetAmount: "1",
  },
  {
    address: MOCK_TOKEN_ADDRESSES.mcbETH,
    symbol: "mcbETH",
    name: "Mantua cbETH",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/27008/small/cbeth.png",
    category: 'lst',
    isMock: true,
    faucetAmount: "1",
  },
];

// Wrapped Assets (4)
export const WRAPPED_TOKENS: Token[] = [
  {
    address: MOCK_TOKEN_ADDRESSES.mWBTC,
    symbol: "mWBTC",
    name: "Mantua WBTC",
    decimals: 8,
    logoURI: "https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png",
    category: 'wrapped',
    isMock: true,
    faucetAmount: "0.01",
  },
  {
    address: MOCK_TOKEN_ADDRESSES.mWETH,
    symbol: "mWETH",
    name: "Mantua WETH",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
    category: 'wrapped',
    isMock: true,
    faucetAmount: "1",
  },
  {
    address: MOCK_TOKEN_ADDRESSES.mWSOL,
    symbol: "mWSOL",
    name: "Mantua WSOL",
    decimals: 9,
    logoURI: "https://assets.coingecko.com/coins/images/21629/small/solana.png",
    category: 'wrapped',
    isMock: true,
    faucetAmount: "5",
  },
  {
    address: MOCK_TOKEN_ADDRESSES.mBTC,
    symbol: "mBTC",
    name: "Mantua BTC",
    decimals: 8,
    logoURI: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
    category: 'wrapped',
    isMock: true,
    faucetAmount: "0.01",
  },
];

// All mock tokens (12 total)
export const MOCK_TOKENS: Token[] = [
  ...STABLECOINS,
  ...RWA_TOKENS,
  ...LST_TOKENS,
  ...WRAPPED_TOKENS,
];

// All available tokens (native + mocks) — 13 total
export const ALL_TOKENS: Token[] = [NATIVE_ETH, ...MOCK_TOKENS];

// Popular tokens for quick access
export const POPULAR_TOKENS: Token[] = [
  NATIVE_ETH,
  STABLECOINS[0], // mUSDC
  STABLECOINS[1], // mUSDT
  WRAPPED_TOKENS[0], // mWBTC
  WRAPPED_TOKENS[1], // mWETH
];

// Helper functions
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
  if (category === 'rwa') return RWA_TOKENS;
  if (category === 'lst') return LST_TOKENS;
  if (category === 'wrapped') return WRAPPED_TOKENS;
  return [];
}

export function getCategoryDisplayName(category: Token['category']): string {
  const names = {
    native: 'Native',
    stablecoin: 'Stablecoins',
    rwa: 'RWA',
    lst: 'LST',
    wrapped: 'Wrapped',
  };
  return names[category];
}

/**
 * Token metadata for external integrations.
 * Maps token symbols (including mock 'm' prefix variants) to CoinGecko IDs.
 * Tokens not present in this map fall back to mock data with a [Mock Data] badge.
 */

export const COINGECKO_IDS: Record<string, string> = {
  // Native / Wrapped ETH
  ETH:     'ethereum',
  WETH:    'weth',
  mWETH:   'weth',
  // Liquid Staking
  mstETH:  'staked-ether',
  mwstETH: 'wrapped-steth',
  mcbETH:  'coinbase-wrapped-staked-eth',
  mrETH:   'rocket-pool-eth',
  // Stablecoins
  USDC:    'usd-coin',
  mUSDC:   'usd-coin',
  USDT:    'tether',
  mUSDT:   'tether',
  DAI:     'dai',
  mDAI:    'dai',
  FRAX:    'frax',
  mFRAX:   'frax',
  // Bitcoin
  WBTC:    'wrapped-bitcoin',
  mWBTC:   'wrapped-bitcoin',
  mBTC:    'bitcoin',
  // Other assets
  LINK:    'chainlink',
  UNI:     'uniswap',
  mWSOL:   'wrapped-solana',
  mWAVAX:  'avalanche-2',
  mWMATIC: 'matic-network',
};

/** Days parameter for each time range tab */
export const COINGECKO_DAYS: Record<string, string> = {
  '1D': '1',
  '7D': '7',
  '30D': '30',
};

/** Cache TTL: 60 seconds */
export const PRICE_CACHE_TTL_MS = 60_000;

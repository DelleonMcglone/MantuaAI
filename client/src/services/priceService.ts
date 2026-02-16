/**
 * Price Service
 *
 * Centralized price management for mock testnet tokens.
 * Future: Replace with Chainlink price feeds or Uniswap TWAP.
 */

import type { Address } from 'viem';
import { getTokenByAddress, getTokenBySymbol } from '../config/tokens';

export interface TokenPrice {
  symbol: string;
  address: Address;
  priceUsd: number;
  lastUpdated: number;
}

/**
 * Mock price data for testnet tokens
 * In production, this would come from Chainlink, Uniswap TWAP, or other oracles
 */
const MOCK_PRICES: Record<string, number> = {
  // Native & Wrapped ETH
  'ETH': 3245.50,
  'mETH': 3245.50,
  'mWETH': 3245.50,

  // Liquid Staking Tokens (slightly higher due to staking rewards)
  'mstETH': 3250.00,
  'mcbETH': 3248.00,
  'mrETH': 3255.00,
  'mwstETH': 3260.00,
  'mrsETH': 3252.00,

  // BTC variants
  'mBTC': 95000.00,
  'mWBTC': 95000.00,

  // Stablecoins (base $1)
  'mUSDC': 1.00,
  'mUSDT': 1.00,
  'mDAI': 1.00,
  'mUSDe': 1.00,
  'mFRAX': 1.00,

  // RWA tokens (roughly $1 with slight variations)
  'mOUSG': 1.02,  // Yield-bearing
  'mUSDY': 1.01,  // Yield-bearing
  'mBUIDL': 1.00,
  'mTBILL': 1.00,
  'mSTEUR': 1.10,  // EUR-denominated

  // Other wrapped assets
  'mWSOL': 185.00,
  'mWAVAX': 42.50,
  'mWMATIC': 0.95,
};

/**
 * Get price in USD for a token by symbol
 */
export function getPriceBySymbol(symbol: string): number {
  return MOCK_PRICES[symbol] || 0;
}

/**
 * Get price in USD for a token by address
 */
export function getPriceByAddress(address: Address): number {
  const token = getTokenByAddress(address);
  if (!token) return 0;
  return MOCK_PRICES[token.symbol] || 0;
}

/**
 * Calculate exchange rate between two tokens
 * Returns: How much of tokenOut you get per 1 tokenIn
 *
 * Example: getExchangeRate(ETH, USDC) = 3245.50 (1 ETH = 3245.50 USDC)
 */
export function getExchangeRate(
  tokenInAddress: Address,
  tokenOutAddress: Address
): number {
  const priceIn = getPriceByAddress(tokenInAddress);
  const priceOut = getPriceByAddress(tokenOutAddress);

  if (priceOut === 0) return 0;

  return priceIn / priceOut;
}

/**
 * Calculate exchange rate as BigInt with 18 decimals precision
 * This is used for BigInt swap calculations
 *
 * Returns: exchange rate * 10^18
 */
export function getExchangeRateBigInt(
  tokenInAddress: Address,
  tokenOutAddress: Address
): bigint {
  const rate = getExchangeRate(tokenInAddress, tokenOutAddress);

  // Convert to BigInt with 18 decimal precision
  // Multiply by 1e6 first to preserve 6 decimal places, then by 1e12
  const rateScaled = Math.floor(rate * 1_000_000);
  return BigInt(rateScaled) * BigInt(10 ** 12);
}

/**
 * Calculate USD value of a token amount
 */
export function calculateUsdValue(
  amount: string | number,
  tokenSymbol: string
): string {
  if (!amount || amount === '' || parseFloat(amount.toString()) === 0) {
    return '0.00';
  }

  const price = getPriceBySymbol(tokenSymbol);
  const value = parseFloat(amount.toString()) * price;
  return value.toFixed(2);
}

/**
 * Get all prices (useful for debugging or batch operations)
 */
export function getAllPrices(): Record<string, number> {
  return { ...MOCK_PRICES };
}

/**
 * Check if price data exists for a token
 */
export function hasPriceData(symbol: string): boolean {
  return symbol in MOCK_PRICES;
}

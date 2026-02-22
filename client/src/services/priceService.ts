/**
 * Price Service
 *
 * Provides USD price lookups for mock testnet tokens.
 * Prefers live CoinGecko prices from the module-level cache in useLivePriceUSD.
 * Falls back to approximate reference prices only when the cache is empty.
 *
 * NOTE: Reference prices below are FALLBACK VALUES for when CoinGecko is
 * unavailable. They do NOT update automatically. The UI uses useLivePriceUSD
 * for all displayed prices — this service is only used for USD-value estimates
 * in the token selector and swap input "≈ $" display.
 */

import type { Address } from 'viem';
import { getTokenByAddress, getTokenBySymbol } from '../config/tokens';
import { getCachedPrice } from '../hooks/useLivePriceUSD';

export interface TokenPrice {
  symbol: string;
  address: Address;
  priceUsd: number;
  lastUpdated: number;
}

/**
 * Approximate reference prices for testnet tokens (fallback only).
 * These values are intentionally approximate and should never be displayed
 * as authoritative prices. The UI uses useLivePriceUSD for all price display.
 */
const REFERENCE_PRICES: Record<string, number> = {
  // Native & Wrapped ETH
  'ETH':    2000,
  'mWETH':  2000,
  // Liquid Staking Tokens
  'mstETH': 2010,
  'mcbETH': 2005,
  // BTC variants
  'mBTC':   90000,
  'mWBTC':  90000,
  // Stablecoins
  'mUSDC':  1.00,
  'mUSDT':  1.00,
  'mUSDE':  1.00,
  'mUSDS':  1.00,
  // RWA tokens (~$1)
  'mUSDY':  1.01,
  'mBUIDL': 1.00,
  // Wrapped assets
  'mWSOL':  150,
};

/**
 * Get price in USD for a token by symbol.
 * Checks the live CoinGecko cache first; falls back to reference price.
 */
export function getPriceBySymbol(symbol: string): number {
  const live = getCachedPrice(symbol);
  if (live !== null) return live;
  return REFERENCE_PRICES[symbol] ?? 0;
}

/**
 * Get price in USD for a token by address
 */
export function getPriceByAddress(address: Address): number {
  const token = getTokenByAddress(address);
  if (!token) return 0;
  return getPriceBySymbol(token.symbol);
}

/**
 * Calculate exchange rate between two tokens
 * Returns: How much of tokenOut you get per 1 tokenIn
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
 */
export function getExchangeRateBigInt(
  tokenInAddress: Address,
  tokenOutAddress: Address
): bigint {
  const rate = getExchangeRate(tokenInAddress, tokenOutAddress);
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
 * Get all reference prices (useful for debugging)
 */
export function getAllPrices(): Record<string, number> {
  return { ...REFERENCE_PRICES };
}

/**
 * Check if price data exists for a token
 */
export function hasPriceData(symbol: string): boolean {
  return symbol in REFERENCE_PRICES || getCachedPrice(symbol) !== null;
}

import type { Address } from 'viem';
import { getTokenByAddress, getTokenBySymbol } from '../config/tokens';
import { getCachedPrice } from '../hooks/useLivePriceUSD';

export interface TokenPrice {
  symbol: string;
  address: Address;
  priceUsd: number;
  lastUpdated: number;
}

const REFERENCE_PRICES: Record<string, number> = {
  'ETH':   2000,
  'cbBTC': 90000,
  'USDC':  1.00,
  'EURC':  1.10,
};

export function getPriceBySymbol(symbol: string): number {
  const live = getCachedPrice(symbol);
  if (live !== null) return live;
  return REFERENCE_PRICES[symbol] ?? 0;
}

export function getPriceByAddress(address: Address): number {
  const token = getTokenByAddress(address);
  if (!token) return 0;
  return getPriceBySymbol(token.symbol);
}

export function getExchangeRate(
  tokenInAddress: Address,
  tokenOutAddress: Address
): number {
  const priceIn = getPriceByAddress(tokenInAddress);
  const priceOut = getPriceByAddress(tokenOutAddress);
  if (priceOut === 0) return 0;
  return priceIn / priceOut;
}

export function getExchangeRateBigInt(
  tokenInAddress: Address,
  tokenOutAddress: Address
): bigint {
  const rate = getExchangeRate(tokenInAddress, tokenOutAddress);
  const rateScaled = Math.floor(rate * 1_000_000);
  return BigInt(rateScaled) * BigInt(10 ** 12);
}

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

export function getAllPrices(): Record<string, number> {
  return { ...REFERENCE_PRICES };
}

export function hasPriceData(symbol: string): boolean {
  return symbol in REFERENCE_PRICES || getCachedPrice(symbol) !== null;
}

/**
 * Swap Quote Hook
 * 
 * Calculates expected output amounts, price impact, and exchange rates
 * for swaps on Uniswap v4 pools.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import type { Address } from 'viem';
import {
  createPoolKey,
  createSwapParams,
  calculateMinimumReceived,
  calculatePriceImpact,
  formatTokenAmount,
  parseTokenAmount,
  isNativeEth,
  FEE_TIERS,
  type PoolKey,
} from '../lib/swap-utils';
import { getExchangeRateBigInt } from '../services/priceService';

export interface SwapQuote {
  inputAmount: bigint;
  outputAmount: bigint;
  minimumReceived: bigint;
  priceImpact: number;
  exchangeRate: string;
  reverseExchangeRate: string;
  fee: bigint;
  poolKey: PoolKey;
}

export interface UseSwapQuoteOptions {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  inputDecimals: number;
  outputDecimals: number;
  slippageTolerance: number;
  hookAddress?: Address;
  feeTier?: number;
  enabled?: boolean;
}

export interface UseSwapQuoteReturn {
  quote: SwapQuote | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const DEBOUNCE_MS = 300;

export function useSwapQuote({
  tokenIn,
  tokenOut,
  amountIn,
  inputDecimals,
  outputDecimals,
  slippageTolerance = 0.5,
  hookAddress,
  feeTier = FEE_TIERS.MEDIUM,
  enabled = true,
}: UseSwapQuoteOptions): UseSwapQuoteReturn {
  const { address: userAddress } = useAccount();
  const [debouncedAmountIn, setDebouncedAmountIn] = useState(amountIn);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAmountIn(amountIn);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [amountIn]);

  const parsedAmountIn = useMemo(() => {
    try {
      return parseTokenAmount(debouncedAmountIn, inputDecimals);
    } catch {
      return BigInt(0);
    }
  }, [debouncedAmountIn, inputDecimals]);

  const poolKey = useMemo(() => {
    if (!tokenIn || !tokenOut) return null;
    return createPoolKey(tokenIn, tokenOut, feeTier, hookAddress);
  }, [tokenIn, tokenOut, feeTier, hookAddress]);

  const swapParams = useMemo(() => {
    if (!tokenIn || !tokenOut || parsedAmountIn === BigInt(0)) return null;
    return createSwapParams(tokenIn, tokenOut, parsedAmountIn, true);
  }, [tokenIn, tokenOut, parsedAmountIn]);

  const quote = useMemo((): SwapQuote | null => {
    if (!poolKey || parsedAmountIn === BigInt(0)) {
      return null;
    }

    // Get actual exchange rate from price service
    const spotPriceFloat = getExchangeRateBigInt(tokenIn, tokenOut);
    const mockSpotPrice = spotPriceFloat > BigInt(0)
      ? spotPriceFloat
      : BigInt(10 ** 18); // Fallback to 1:1 if no price data

    // Deduct fee
    const feeAmount = (parsedAmountIn * BigInt(feeTier)) / BigInt(1000000);
    const amountAfterFee = parsedAmountIn - feeAmount;

    // Apply exchange rate with decimal handling
    // Formula: outputAmount = (inputAmount * spotPrice * 10^outputDecimals) / (10^inputDecimals * 10^18)
    const numerator = amountAfterFee * mockSpotPrice * BigInt(10 ** outputDecimals);
    const denominator = BigInt(10 ** inputDecimals) * BigInt(10 ** 18);
    const outputAmount = numerator / denominator;

    const minimumReceived = calculateMinimumReceived(outputAmount, slippageTolerance);

    const priceImpact = calculatePriceImpact(
      parsedAmountIn,
      outputAmount,
      mockSpotPrice,
      inputDecimals,
      outputDecimals
    );

    const formattedIn = formatTokenAmount(parsedAmountIn, inputDecimals);
    const formattedOut = formatTokenAmount(outputAmount, outputDecimals);

    const inNum = parseFloat(formattedIn) || 1;
    const outNum = parseFloat(formattedOut) || 0;

    const exchangeRate = `1 = ${(outNum / inNum).toFixed(6)}`;
    const reverseExchangeRate = `1 = ${(inNum / outNum).toFixed(6)}`;

    return {
      inputAmount: parsedAmountIn,
      outputAmount,
      minimumReceived,
      priceImpact,
      exchangeRate,
      reverseExchangeRate,
      fee: feeAmount,
      poolKey,
    };
  }, [poolKey, parsedAmountIn, feeTier, inputDecimals, outputDecimals, slippageTolerance, tokenIn, tokenOut]);

  const refetch = useCallback(() => {
    setDebouncedAmountIn(amountIn);
  }, [amountIn]);

  return {
    quote,
    isLoading,
    error,
    refetch,
  };
}

export function getPriceImpactColor(priceImpact: number): string {
  if (priceImpact < 1) return '#10b981';
  if (priceImpact < 5) return '#f59e0b';
  return '#ef4444';
}

export function getPriceImpactSeverity(priceImpact: number): 'low' | 'medium' | 'high' {
  if (priceImpact < 1) return 'low';
  if (priceImpact < 5) return 'medium';
  return 'high';
}

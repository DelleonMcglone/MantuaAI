import { useEffect, useState, useCallback } from 'react';
import { useChainId, usePublicClient } from 'wagmi';
import type { Address } from 'viem';
import StateViewABI from '../abis/StateView.json';
import { getV4Address } from '../config/contracts';
import { createPoolKey, getPoolId, type PoolKey } from '../lib/swap-utils';

export interface PoolState {
  isLoading: boolean;
  isInitialized: boolean;
  hasLiquidity: boolean;
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  poolId: `0x${string}` | null;
  poolKey: PoolKey | null;
  error: string | null;
}

const INITIAL_STATE: PoolState = {
  isLoading: false,
  isInitialized: false,
  hasLiquidity: false,
  sqrtPriceX96: BigInt(0),
  tick: 0,
  liquidity: BigInt(0),
  poolId: null,
  poolKey: null,
  error: null,
};

export function usePoolState(
  tokenA: Address | undefined,
  tokenB: Address | undefined,
  fee: number = 3000,
  hookAddress: Address = '0x0000000000000000000000000000000000000000'
): PoolState & { refetch: () => void } {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [state, setState] = useState<PoolState>(INITIAL_STATE);

  const fetchPoolState = useCallback(async () => {
    if (!tokenA || !tokenB || !publicClient) {
      setState(INITIAL_STATE);
      return;
    }

    if (tokenA.toLowerCase() === tokenB.toLowerCase()) {
      setState({ ...INITIAL_STATE, error: 'Cannot check pool for same token pair' });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const poolKey = createPoolKey(tokenA, tokenB, fee, hookAddress);
      const poolId = getPoolId(poolKey);

      let stateViewAddress: Address;
      try {
        stateViewAddress = getV4Address(chainId, 'stateView');
      } catch {
        setState({
          ...INITIAL_STATE,
          poolKey,
          poolId,
          error: 'StateView not available on this chain',
        });
        return;
      }

      const [slot0Result, liquidityResult] = await Promise.allSettled([
        publicClient.readContract({
          address: stateViewAddress,
          abi: StateViewABI,
          functionName: 'getSlot0',
          args: [poolId],
        }),
        publicClient.readContract({
          address: stateViewAddress,
          abi: StateViewABI,
          functionName: 'getLiquidity',
          args: [poolId],
        }),
      ]);

      let sqrtPriceX96 = BigInt(0);
      let tick = 0;
      let isInitialized = false;

      if (slot0Result.status === 'fulfilled') {
        const slot0 = slot0Result.value as [bigint, number, number, number];
        sqrtPriceX96 = slot0[0];
        tick = slot0[1];
        isInitialized = sqrtPriceX96 > BigInt(0);
      }

      let liquidity = BigInt(0);
      let hasLiquidity = false;

      if (liquidityResult.status === 'fulfilled') {
        liquidity = liquidityResult.value as bigint;
        hasLiquidity = liquidity > BigInt(0);
      }

      setState({
        isLoading: false,
        isInitialized,
        hasLiquidity,
        sqrtPriceX96,
        tick,
        liquidity,
        poolId,
        poolKey,
        error: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: `Failed to read pool state: ${msg.slice(0, 100)}`,
      }));
    }
  }, [tokenA, tokenB, fee, hookAddress, chainId, publicClient]);

  useEffect(() => {
    fetchPoolState();
  }, [fetchPoolState]);

  return { ...state, refetch: fetchPoolState };
}

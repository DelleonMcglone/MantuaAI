/**
 * useAddLiquidity — Hook for adding liquidity via PoolModifyLiquidityTest
 *
 * Calls PoolModifyLiquidityTest.modifyLiquidity() with the given pool key,
 * tick range, and liquidity delta. Tracks transaction lifecycle states.
 */

import { useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import PoolModifyLiquidityTestABI from '../abis/PoolModifyLiquidityTest.json';
import { getPoolModifyLiquidityTestAddress, type PoolKey } from '../lib/swap-utils';

export interface AddLiquidityParams {
  poolKey: PoolKey;
  tickLower: number;
  tickUpper: number;
  liquidityDelta: bigint;
  hookData: `0x${string}`;
}

export function useAddLiquidity() {
  const chainId = useChainId();

  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const addLiquidity = (params: AddLiquidityParams) => {
    let contractAddress: `0x${string}`;
    try {
      contractAddress = getPoolModifyLiquidityTestAddress(chainId);
    } catch (err) {
      console.error('[useAddLiquidity]', err);
      return;
    }

    const salt = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

    writeContract({
      address: contractAddress,
      abi: PoolModifyLiquidityTestABI,
      functionName: 'modifyLiquidity',
      args: [
        {
          currency0: params.poolKey.currency0,
          currency1: params.poolKey.currency1,
          fee: params.poolKey.fee,
          tickSpacing: params.poolKey.tickSpacing,
          hooks: params.poolKey.hooks,
        },
        {
          tickLower: params.tickLower,
          tickUpper: params.tickUpper,
          liquidityDelta: params.liquidityDelta,
          salt,
        },
        params.hookData,
      ],
    });
  };

  return {
    addLiquidity,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError,
    reset,
  };
}

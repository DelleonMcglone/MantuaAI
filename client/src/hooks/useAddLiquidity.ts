import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useChainId, usePublicClient } from 'wagmi';
import PoolModifyLiquidityTestABI from '../abis/PoolModifyLiquidityTest.json';
import PoolManagerABI from '../abis/PoolManager.json';
import StateViewABI from '../abis/StateView.json';
import { getPoolModifyLiquidityTestAddress, getPoolManagerAddress, getStateViewAddress, getPoolId, type PoolKey } from '../lib/swap-utils';
import { decodeV4Error, isAlreadyInitializedError } from '../lib/v4Errors';

export interface AddLiquidityParams {
  poolKey: PoolKey;
  tickLower: number;
  tickUpper: number;
  liquidityDelta: bigint;
  hookData: `0x${string}`;
  /** ETH to send as msg.value when currency0 is native ETH */
  ethValue?: bigint;
}

const SQRT_PRICE_1_1 = BigInt('79228162514264337593543950336');

function getSqrtPriceForPair(currency0Decimals: number, currency1Decimals: number): bigint {
  if (currency0Decimals === currency1Decimals) {
    return SQRT_PRICE_1_1;
  }
  const decimalDiff = currency1Decimals - currency0Decimals;
  if (decimalDiff > 0) {
    return SQRT_PRICE_1_1 * BigInt(10 ** (decimalDiff / 2));
  }
  return SQRT_PRICE_1_1 / BigInt(10 ** (Math.abs(decimalDiff) / 2));
}

export function useAddLiquidity() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [setupError, setSetupError] = useState<Error | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initTxHash, setInitTxHash] = useState<`0x${string}` | undefined>();

  const {
    writeContract,
    writeContractAsync,
    data: hash,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const checkPoolInitialized = async (poolKey: PoolKey): Promise<boolean> => {
    if (!publicClient) return true;
    try {
      const stateViewAddress = getStateViewAddress(chainId);
      const poolId = getPoolId(poolKey);
      const slot0 = await publicClient.readContract({
        address: stateViewAddress,
        abi: StateViewABI,
        functionName: 'getSlot0',
        args: [poolId],
      }) as [bigint, number, number, number];
      return slot0[0] > BigInt(0);
    } catch {
      return false;
    }
  };

  const initializePool = async (
    poolKey: PoolKey,
    currency0Decimals: number = 18,
    currency1Decimals: number = 18,
    sqrtPriceX96Override?: bigint
  ): Promise<boolean> => {
    if (!publicClient) {
      setSetupError(new Error('Public client not available'));
      return false;
    }

    setIsInitializing(true);
    setSetupError(null);

    try {
      const poolManagerAddress = getPoolManagerAddress(chainId);
      const price = sqrtPriceX96Override || getSqrtPriceForPair(currency0Decimals, currency1Decimals);

      console.log('[useAddLiquidity] Initializing pool...', {
        poolKey,
        sqrtPriceX96: price.toString(),
        poolManager: poolManagerAddress,
      });

      const initHash = await writeContractAsync({
        address: poolManagerAddress,
        abi: PoolManagerABI,
        functionName: 'initialize',
        args: [
          {
            currency0: poolKey.currency0,
            currency1: poolKey.currency1,
            fee: poolKey.fee,
            tickSpacing: poolKey.tickSpacing,
            hooks: poolKey.hooks,
          },
          price,
          '0x' as `0x${string}`,
        ],
      });

      setInitTxHash(initHash);
      console.log('[useAddLiquidity] Pool initialization tx:', initHash);

      await publicClient.waitForTransactionReceipt({ hash: initHash });
      setIsInitializing(false);
      return true;
    } catch (err) {
      setIsInitializing(false);
      const msg = err instanceof Error ? err.message : String(err);

      if (isAlreadyInitializedError(msg)) {
        console.log('[useAddLiquidity] Pool already initialized, continuing...');
        return true;
      }

      const decoded = decodeV4Error(msg);
      setSetupError(new Error(decoded || `Pool initialization failed: ${msg.slice(0, 100)}`));
      console.error('[useAddLiquidity] Pool initialization failed:', err);
      return false;
    }
  };

  const addLiquidity = async (
    params: AddLiquidityParams,
    autoInitialize: boolean = true,
    currency0Decimals: number = 18,
    currency1Decimals: number = 18
  ) => {
    setSetupError(null);
    let contractAddress: `0x${string}`;
    try {
      contractAddress = getPoolModifyLiquidityTestAddress(chainId);
    } catch (err) {
      console.error('[useAddLiquidity]', err);
      setSetupError(err instanceof Error ? err : new Error('Contract not configured for this chain'));
      return;
    }

    if (autoInitialize) {
      const isInit = await checkPoolInitialized(params.poolKey);
      if (!isInit) {
        console.log('[useAddLiquidity] Pool not initialized, auto-initializing...');
        const initSuccess = await initializePool(params.poolKey, currency0Decimals, currency1Decimals);
        if (!initSuccess) {
          return;
        }
      }
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
      // Send ETH value when currency0 is native ETH (address 0x000...000)
      value: params.ethValue ?? BigInt(0),
    });
  };

  const displayError = setupError ?? writeError;
  const errorMessage = displayError ? (() => {
    const msg = displayError instanceof Error ? displayError.message : String(displayError);
    const decoded = decodeV4Error(msg);
    return decoded ? new Error(decoded) : displayError;
  })() : null;

  return {
    addLiquidity,
    initializePool,
    checkPoolInitialized,
    hash,
    initTxHash,
    isPending: isPending || isInitializing,
    isInitializing,
    isConfirming,
    isSuccess,
    error: errorMessage,
    reset,
  };
}

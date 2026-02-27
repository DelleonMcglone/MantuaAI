import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useChainId, usePublicClient } from 'wagmi';
import { maxUint256, erc20Abi, type Address } from 'viem';
import PoolModifyLiquidityTestABI from '../abis/PoolModifyLiquidityTest.json';
import StateViewABI from '../abis/StateView.json';
import {
  getPoolModifyLiquidityTestAddress,
  getPoolManagerAddress,
  getStateViewAddress,
  getPoolId,
  isNativeEth,
  type PoolKey,
} from '../lib/swap-utils';
import { decodeV4Error, isAlreadyInitializedError } from '../lib/v4Errors';

function sqrtBigInt(n: bigint): bigint {
  if (n <= 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; }
  return x;
}

export function computeSqrtPriceX96(
  priceToken1PerToken0: number,
  decimals0: number,
  decimals1: number
): bigint {
  const Q96 = 2n ** 96n;
  const SCALE = 10n ** 18n;
  const priceScaled = BigInt(Math.round(priceToken1PerToken0 * 1e9)) * (10n ** BigInt(decimals1)) * SCALE
    / (10n ** BigInt(decimals0)) / 10n ** 9n;
  return sqrtBigInt(priceScaled * Q96 * Q96 / SCALE);
}

export interface AddLiquidityParams {
  poolKey: PoolKey;
  tickLower: number;
  tickUpper: number;
  liquidityDelta: bigint;
  hookData: `0x${string}`;
  ethValue?: bigint;
}

const POOL_MANAGER_ABI = [
  {
    name: 'initialize',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      { name: 'sqrtPriceX96', type: 'uint160' },
    ],
    outputs: [{ name: 'tick', type: 'int24' }],
  },
] as const;

export function useAddLiquidity() {
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const [setupError, setSetupError] = useState<Error | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initTxHash, setInitTxHash] = useState<`0x${string}` | undefined>();
  const [approvalStep, setApprovalStep] = useState<string | null>(null);

  const {
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
      return slot0[0] > 0n;
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
      const price = sqrtPriceX96Override || computeSqrtPriceX96(1.0, currency0Decimals, currency1Decimals);

      console.log('[useAddLiquidity] Initializing pool...', {
        poolKey,
        sqrtPriceX96: price.toString(),
        currency0Decimals,
        currency1Decimals,
      });

      const tx = await writeContractAsync({
        address: poolManagerAddress,
        abi: POOL_MANAGER_ABI,
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
        ],
      });

      setInitTxHash(tx);
      console.log('[useAddLiquidity] Pool initialized, tx:', tx);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setIsInitializing(false);
      return true;
    } catch (err) {
      setIsInitializing(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (isAlreadyInitializedError(msg)) {
        console.log('[useAddLiquidity] Pool already initialized');
        return true;
      }
      const decoded = decodeV4Error(msg);
      setSetupError(new Error(decoded || `Pool initialization failed: ${msg.slice(0, 150)}`));
      console.error('[useAddLiquidity] Initialize error:', err);
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

    try {
      if (!publicClient) throw new Error('Public client not available');

      const isNativeCurrency0 = isNativeEth(params.poolKey.currency0);
      const isNativeCurrency1 = isNativeEth(params.poolKey.currency1);

      if (!isNativeCurrency0) {
        const allowance = await publicClient.readContract({
          address: params.poolKey.currency0 as `0x${string}`,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [await publicClient.getAddresses().then(a => a[0]) || '0x0000000000000000000000000000000000000000' as `0x${string}`, contractAddress],
        }) as bigint;

        if (allowance < params.liquidityDelta) {
          setApprovalStep(`Approving token...`);
          const approveTx = await writeContractAsync({
            address: params.poolKey.currency0 as `0x${string}`,
            abi: erc20Abi,
            functionName: 'approve',
            args: [contractAddress, maxUint256],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }
      }

      if (!isNativeCurrency1) {
        const allowance = await publicClient.readContract({
          address: params.poolKey.currency1 as `0x${string}`,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [await publicClient.getAddresses().then(a => a[0]) || '0x0000000000000000000000000000000000000000' as `0x${string}`, contractAddress],
        }) as bigint;

        if (allowance < params.liquidityDelta) {
          setApprovalStep(`Approving token...`);
          const approveTx = await writeContractAsync({
            address: params.poolKey.currency1 as `0x${string}`,
            abi: erc20Abi,
            functionName: 'approve',
            args: [contractAddress, maxUint256],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }
      }

      setApprovalStep(null);

      const ethValue = (isNativeCurrency0 || isNativeCurrency1) ? params.ethValue ?? 0n : 0n;

      await writeContractAsync({
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
        value: ethValue,
      });
    } catch (err) {
      setApprovalStep(null);
      const msg = err instanceof Error ? err.message : String(err);
      const decoded = decodeV4Error(msg);
      setSetupError(new Error(decoded || `Add liquidity failed: ${msg.slice(0, 150)}`));
      console.error('[useAddLiquidity] Error:', err);
    }
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
    approvalStep,
    isPending: isPending || isInitializing,
    isInitializing,
    isConfirming,
    isSuccess,
    error: errorMessage,
    reset,
  };
}

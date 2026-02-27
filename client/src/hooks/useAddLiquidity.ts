import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useChainId, usePublicClient } from 'wagmi';
import { maxUint256, erc20Abi, type Address } from 'viem';
import JSBI from 'jsbi';
import { Percent } from '@uniswap/sdk-core';
import { Pool, Position, V4PositionManager } from '@uniswap/v4-sdk';
import PositionManagerABI from '../abis/PositionManager.json';
import Permit2ABI from '../abis/Permit2.json';
import StateViewABI from '../abis/StateView.json';
import {
  getPositionManagerAddress,
  getPermit2Address,
  getStateViewAddress,
  getPoolId,
  isNativeEth,
  type PoolKey,
} from '../lib/swap-utils';
import { decodeV4Error, isAlreadyInitializedError } from '../lib/v4Errors';
import { getPriceBySymbol } from '../services/priceService';

// --------------------------------------------------------------------------
// sqrtPriceX96 helpers
// --------------------------------------------------------------------------

/** Integer square root using Newton's method. */
function sqrtBigInt(n: bigint): bigint {
  if (n <= 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; }
  return x;
}

/**
 * Compute sqrtPriceX96 for an ETH/stable (or any token0/token1) pair.
 *
 * price = token1 per token0 (in human units)
 *       = (token1 amount) / (token0 amount)
 *
 * Adjusted for decimals: price_raw = price * 10^d1 / 10^d0
 * sqrtPriceX96 = sqrt(price_raw) * 2^96
 */
export function computeSqrtPriceX96(
  priceToken1PerToken0: number,
  decimals0: number,
  decimals1: number
): bigint {
  const Q96 = 2n ** 96n;
  // Work in fixed-point with 18 decimals of precision to avoid float truncation
  const SCALE = 10n ** 18n;
  const priceScaled = BigInt(Math.round(priceToken1PerToken0 * 1e9)) * (10n ** BigInt(decimals1)) * SCALE
    / (10n ** BigInt(decimals0)) / 10n ** 9n;
  // sqrtPriceX96 = sqrt(priceScaled / SCALE) * Q96
  //              = sqrt(priceScaled * Q96^2 / SCALE)
  return sqrtBigInt(priceScaled * Q96 * Q96 / SCALE);
}

// --------------------------------------------------------------------------
// Hook types
// --------------------------------------------------------------------------

export interface AddLiquidityParams {
  poolKey: PoolKey;
  tickLower: number;
  tickUpper: number;
  liquidityDelta: bigint;   // kept for API compatibility — recomputed internally
  hookData: `0x${string}`;
  ethValue?: bigint;
  /** Decimals of currency0 */
  currency0Decimals?: number;
  /** Decimals of currency1 */
  currency1Decimals?: number;
  /** Amount of currency0 the user wants to provide (in raw units) */
  amount0Desired?: bigint;
  /** Amount of currency1 the user wants to provide (in raw units) */
  amount1Desired?: bigint;
}

// --------------------------------------------------------------------------
// Main hook
// --------------------------------------------------------------------------

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

  // ------------------------------------------------------------------
  // Pool initialization check (via StateView)
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // Step 1: ensure ERC20 is approved to Permit2
  // ------------------------------------------------------------------
  const ensureERC20ApprovalToPermit2 = async (
    tokenAddress: Address,
    userAddress: Address
  ) => {
    if (!publicClient) throw new Error('Public client not available');
    const permit2Address = getPermit2Address(chainId);

    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [userAddress, permit2Address],
    }) as bigint;

    if (allowance < maxUint256 / 2n) {
      setApprovalStep('Approving token to Permit2…');
      const tx = await writeContractAsync({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [permit2Address, maxUint256],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }
  };

  // ------------------------------------------------------------------
  // Step 2: ensure Permit2 has allowance to PositionManager
  // ------------------------------------------------------------------
  const ensurePermit2AllowanceToPositionManager = async (
    tokenAddress: Address,
    userAddress: Address,
    requiredAmount: bigint
  ) => {
    if (!publicClient) throw new Error('Public client not available');
    const permit2Address = getPermit2Address(chainId);
    const positionManagerAddress = getPositionManagerAddress(chainId);
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 86400); // 24h

    const result = await publicClient.readContract({
      address: permit2Address,
      abi: Permit2ABI,
      functionName: 'allowance',
      args: [userAddress, tokenAddress, positionManagerAddress],
    }) as [bigint, bigint, bigint];

    const [currentAmount, currentExpiry] = result;
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    if (currentAmount < requiredAmount || currentExpiry < nowSec) {
      setApprovalStep('Approving Permit2 to PositionManager…');
      // uint160 max ≈ 1.46e48 — use 2^160 - 1
      const maxUint160 = 2n ** 160n - 1n;
      const tx = await writeContractAsync({
        address: permit2Address,
        abi: Permit2ABI,
        functionName: 'approve',
        args: [tokenAddress, positionManagerAddress, maxUint160, expiry],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }
  };

  // ------------------------------------------------------------------
  // Main addLiquidity entry point
  // ------------------------------------------------------------------
  const addLiquidity = async (
    params: AddLiquidityParams,
    autoInitialize = true,
    currency0Decimals = 18,
    currency1Decimals = 18,
    userAddress?: Address
  ) => {
    if (!publicClient || !userAddress) {
      setSetupError(new Error('Wallet not connected'));
      return;
    }
    setSetupError(null);
    setApprovalStep(null);

    // Merge decimals from params if provided
    const dec0 = params.currency0Decimals ?? currency0Decimals;
    const dec1 = params.currency1Decimals ?? currency1Decimals;

    try {
      const positionManagerAddress = getPositionManagerAddress(chainId);
      const isNativeCurrency0 = isNativeEth(params.poolKey.currency0);
      const isNativeCurrency1 = isNativeEth(params.poolKey.currency1);

      // ---------------------------------------------------------------
      // Permit2 approvals for non-native tokens
      // ---------------------------------------------------------------
      if (!isNativeCurrency0 && params.amount0Desired && params.amount0Desired > 0n) {
        await ensureERC20ApprovalToPermit2(params.poolKey.currency0, userAddress);
        await ensurePermit2AllowanceToPositionManager(
          params.poolKey.currency0, userAddress, params.amount0Desired
        );
      }
      if (!isNativeCurrency1 && params.amount1Desired && params.amount1Desired > 0n) {
        await ensureERC20ApprovalToPermit2(params.poolKey.currency1, userAddress);
        await ensurePermit2AllowanceToPositionManager(
          params.poolKey.currency1, userAddress, params.amount1Desired
        );
      }
      setApprovalStep(null);

      // ---------------------------------------------------------------
      // Build SDK Pool + Position objects
      // ---------------------------------------------------------------
      // Determine current or initial sqrtPriceX96
      let currentSqrtPriceX96 = 0n;
      let currentTick = 0;
      let currentLiquidity = 0n;
      const poolId = getPoolId(params.poolKey);

      try {
        const stateViewAddress = getStateViewAddress(chainId);
        const slot0 = await publicClient.readContract({
          address: stateViewAddress,
          abi: StateViewABI,
          functionName: 'getSlot0',
          args: [poolId],
        }) as [bigint, number, number, number];
        currentSqrtPriceX96 = slot0[0];
        currentTick = slot0[1];
        currentLiquidity = await publicClient.readContract({
          address: stateViewAddress,
          abi: StateViewABI,
          functionName: 'getLiquidity',
          args: [poolId],
        }) as bigint;
      } catch {
        // Pool not yet initialized — we'll create it
      }

      const needsInit = currentSqrtPriceX96 === 0n;

      // For new pools: derive initial sqrtPriceX96 from live price
      let initSqrtPriceX96 = currentSqrtPriceX96;
      if (needsInit) {
        // Determine human price (currency1 per currency0)
        // The price service stores USD per token symbol.
        // If currency0 is native ETH (address 0) and currency1 is a USD stablecoin:
        //   price = usdcPerEth = ethUsdPrice * (10^dec1 / 10^dec0)
        // For non-ETH pairs we fall back to 1:1 adjusted for decimals.
        const c0IsEth = isNativeCurrency0;
        const c1IsEth = isNativeCurrency1;

        let priceHuman = 1.0;
        if (c0IsEth && !c1IsEth) {
          // price = USDC per ETH (or stablecoin per ETH)
          const ethUsd = getPriceBySymbol('ETH') || 2500;
          const tokenUsd = getPriceBySymbol('USDC') || 1;
          priceHuman = ethUsd / tokenUsd;
        } else if (!c0IsEth && c1IsEth) {
          const ethUsd = getPriceBySymbol('ETH') || 2500;
          const tokenUsd = getPriceBySymbol('USDC') || 1;
          priceHuman = tokenUsd / ethUsd;
        }

        initSqrtPriceX96 = computeSqrtPriceX96(priceHuman, dec0, dec1);
        currentTick = 0; // SDK will compute from sqrtPrice
      }

      // Build SDK Pool with a minimal (empty) tick data provider
      const pool = new Pool(
        // currency0 and currency1 as SDK Currency objects (use Token or Ether)
        // The v4-sdk Pool constructor accepts plain address strings for currencies
        // when using the low-level interface. We pass the address strings directly.
        { address: params.poolKey.currency0, decimals: dec0, chainId } as any,
        { address: params.poolKey.currency1, decimals: dec1, chainId } as any,
        params.poolKey.fee,
        params.poolKey.tickSpacing,
        params.poolKey.hooks,
        JSBI.BigInt(initSqrtPriceX96.toString()),
        JSBI.BigInt(currentLiquidity.toString()),
        currentTick,
        []
      );

      // Compute position from desired amounts using SDK
      const amount0 = params.amount0Desired ?? params.liquidityDelta;
      const amount1 = params.amount1Desired ?? 0n;

      let position: Position;
      try {
        position = Position.fromAmounts({
          pool,
          tickLower: params.tickLower,
          tickUpper: params.tickUpper,
          amount0: JSBI.BigInt(amount0.toString()),
          amount1: JSBI.BigInt(amount1.toString()),
          useFullPrecision: true,
        });
      } catch {
        // Fallback: use amount1 as the basis if amount0 produces dust
        position = Position.fromAmounts({
          pool,
          tickLower: params.tickLower,
          tickUpper: params.tickUpper,
          amount0: JSBI.BigInt('0'),
          amount1: JSBI.BigInt((amount1 > 0n ? amount1 : amount0).toString()),
          useFullPrecision: true,
        });
      }

      // ---------------------------------------------------------------
      // Build PositionManager calldata via SDK
      // ---------------------------------------------------------------
      const slippage = new Percent(50, 10_000); // 0.5%
      const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 min

      const { calldata, value } = V4PositionManager.addCallParameters(position, {
        recipient: userAddress,
        slippageTolerance: slippage,
        deadline,
        ...(needsInit ? {
          createPool: true,
          sqrtPriceX96: initSqrtPriceX96.toString(),
        } : {}),
        ...(isNativeCurrency0 || isNativeCurrency1 ? {
          useNative: { decimals: 18, symbol: 'ETH', name: 'Ethereum', chainId, isNative: true, isToken: false, equals: () => false, wrapped: null as any },
        } : {}),
      });

      setIsInitializing(needsInit);

      // ---------------------------------------------------------------
      // Decode calldata to extract (unlockData, deadline) args for writeContract
      // calldata = 4-byte selector + abi.encode(bytes unlockData, uint256 deadline)
      // ---------------------------------------------------------------
      const { decodeAbiParameters, parseAbiParameters } = await import('viem');
      const argsData = `0x${calldata.slice(10)}` as `0x${string}`; // strip selector
      const [unlockData, deadlineBigInt] = decodeAbiParameters(
        parseAbiParameters('bytes, uint256'),
        argsData
      );

      const txHash = await writeContractAsync({
        address: positionManagerAddress,
        abi: PositionManagerABI,
        functionName: 'modifyLiquidities',
        args: [unlockData, deadlineBigInt],
        value: BigInt(value ?? '0'),
      });

      setInitTxHash(txHash);
      if (needsInit) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }
      setIsInitializing(false);

    } catch (err) {
      setIsInitializing(false);
      setApprovalStep(null);
      const msg = err instanceof Error ? err.message : String(err);
      if (isAlreadyInitializedError(msg)) {
        // Retry without createPool flag (race condition — pool was just created)
        return addLiquidity({ ...params, }, false, currency0Decimals, currency1Decimals, userAddress);
      }
      const decoded = decodeV4Error(msg);
      setSetupError(new Error(decoded || `Liquidity error: ${msg.slice(0, 150)}`));
      console.error('[useAddLiquidity] Error:', err);
    }
  };

  // Surface the error, preferring setup/approval errors over write errors
  const displayError = setupError ?? writeError;
  const errorMessage = displayError ? (() => {
    const msg = displayError instanceof Error ? displayError.message : String(displayError);
    const decoded = decodeV4Error(msg);
    return decoded ? new Error(decoded) : displayError;
  })() : null;

  return {
    addLiquidity,
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

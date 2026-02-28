/**
 * useAddLiquidity — Uniswap v4 PositionManager + Permit2 flow
 *
 * Step 1: ERC20.approve(Permit2, MaxUint256)        — skipped if already done
 * Step 2: Permit2.approve(token, PositionManager)   — per-operation allowance
 * Step 3: PositionManager.multicall([initializePool?, modifyLiquidities])
 */
import { useState, useCallback } from 'react';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  usePublicClient,
} from 'wagmi';
import {
  maxUint256,
  erc20Abi,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  type Address,
} from 'viem';
import PositionManagerABI from '../abis/PositionManager.json';
import {
  getPositionManagerAddress,
  getPermit2Address,
  getStateViewAddress,
  getPoolId,
  isNativeEth,
  type PoolKey,
} from '../lib/swap-utils';
import { decodeV4Error, isAlreadyInitializedError } from '../lib/v4Errors';

// ──────────────────────────────────────────────────────────────────────────────
// Inline ABIs
// ──────────────────────────────────────────────────────────────────────────────

const PERMIT2_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token',      type: 'address' },
      { name: 'spender',    type: 'address' },
      { name: 'amount',     type: 'uint160' },
      { name: 'expiration', type: 'uint48'  },
    ],
    outputs: [],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user',    type: 'address' },
      { name: 'token',   type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [
      { name: 'amount',     type: 'uint160' },
      { name: 'expiration', type: 'uint48'  },
      { name: 'nonce',      type: 'uint48'  },
    ],
  },
] as const;

const STATE_VIEW_ABI = [
  {
    name: 'getSlot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick',         type: 'int24'   },
      { name: 'protocolFee',  type: 'uint24'  },
      { name: 'lpFee',        type: 'uint24'  },
    ],
  },
] as const;

// ──────────────────────────────────────────────────────────────────────────────
// TickMath — getSqrtRatioAtTick (direct BigInt port of TickMath.sol)
// ──────────────────────────────────────────────────────────────────────────────

export function getSqrtRatioAtTick(tick: number): bigint {
  const absTick = BigInt(Math.abs(tick));
  const Q128 = 2n ** 128n;

  let ratio: bigint =
    (absTick & 1n) !== 0n ? 0xfffcb933bd6fad37aa2d162d1a594001n : Q128;

  const factors: Array<[bigint, bigint]> = [
    [2n,      0xfff97272373d413259a46990580e213an],
    [4n,      0xfff2e50f5f656932ef12357cf3c7fdccn],
    [8n,      0xffe5caca7e10e4e61c3624eaa0941cd0n],
    [16n,     0xffcb9843d60f6159c9db58835c926644n],
    [32n,     0xff973b41fa98c081472e6896dfb254c0n],
    [64n,     0xff2ea16466c96a3843ec78b326b52861n],
    [128n,    0xfe5dee046a99a2a811c461f1969c3053n],
    [256n,    0xfcbe86c7900a88aedcffc83b479aa3a4n],
    [512n,    0xf987a7253ac413176f2b074cf7815e54n],
    [1024n,   0xf3392b0822b70005940c7a398e4b70f3n],
    [2048n,   0xe7159475a2c29b7443b29c7fa6e889d9n],
    [4096n,   0xd097f3bdfd2022b8845ad8f792aa5825n],
    [8192n,   0xa9f746462d870fdf8a65dc1f90e061e5n],
    [16384n,  0x70d869a156d2a1b890bb3df62baf32f7n],
    [32768n,  0x31be135f97d08fd981231505542fcfa6n],
    [65536n,  0x9aa508b5b7a84e1c677de54f3e99bc9n],
    [131072n, 0x5d6af8dedb81196699c329225ee604n],
    [262144n, 0x2216e584f5fa1ea926041bedfe98n],
    [524288n, 0x48a170391f7dc42444e8fa2n],
  ];

  for (const [bit, magic] of factors) {
    if ((absTick & bit) !== 0n) ratio = (ratio * magic) >> 128n;
  }

  if (tick > 0) ratio = ((1n << 256n) - 1n) / ratio;

  // Q128.128 → Q64.96 (sqrtPriceX96), round up
  return (ratio >> 32n) + ((ratio & ((1n << 32n) - 1n)) > 0n ? 1n : 0n);
}

// ──────────────────────────────────────────────────────────────────────────────
// sqrtPriceX96 from human price (kept for use in form)
// ──────────────────────────────────────────────────────────────────────────────

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
  decimals1: number,
): bigint {
  const Q96   = 2n ** 96n;
  const SCALE = 10n ** 18n;
  const priceScaled =
    BigInt(Math.round(priceToken1PerToken0 * 1e9)) *
    (10n ** BigInt(decimals1)) *
    SCALE /
    (10n ** BigInt(decimals0)) /
    10n ** 9n;
  return sqrtBigInt(priceScaled * Q96 * Q96 / SCALE);
}

// ──────────────────────────────────────────────────────────────────────────────
// Liquidity from token amounts
// ──────────────────────────────────────────────────────────────────────────────

export function computeLiquidityFromAmounts(
  amount0Desired: bigint,
  amount1Desired: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
): bigint {
  const Q96   = 2n ** 96n;
  const sqrtA = getSqrtRatioAtTick(tickLower);
  const sqrtB = getSqrtRatioAtTick(tickUpper);
  const sqrtP = sqrtPriceX96;

  if (sqrtP <= sqrtA) {
    if (sqrtB === sqrtA) return 0n;
    return amount0Desired * sqrtA * sqrtB / ((sqrtB - sqrtA) * Q96);
  }
  if (sqrtP >= sqrtB) {
    if (sqrtB === sqrtA) return 0n;
    return amount1Desired * Q96 / (sqrtB - sqrtA);
  }

  const l0 = (sqrtB > sqrtP)
    ? amount0Desired * sqrtP * sqrtB / ((sqrtB - sqrtP) * Q96)
    : 0n;
  const l1 = (sqrtP > sqrtA)
    ? amount1Desired * Q96 / (sqrtP - sqrtA)
    : 0n;

  return l0 > 0n && l1 > 0n ? (l0 < l1 ? l0 : l1) : (l0 > 0n ? l0 : l1);
}

// ──────────────────────────────────────────────────────────────────────────────
// Encode modifyLiquidities unlockData
//
// V4 Actions (from @uniswap/v4-sdk):
//   MINT_POSITION = 0x02
//   SETTLE_PAIR   = 0x0d (13)
//   SWEEP         = 0x14 (20) — sweep excess native ETH back
//
// MINT_POSITION params: (PoolKey, tickLower, tickUpper, liquidity uint256,
//                        amount0Max uint128, amount1Max uint128, owner, hookData)
// SETTLE_PAIR params:   (currency0, currency1)
// SWEEP params:         (currency, recipient)
// ──────────────────────────────────────────────────────────────────────────────

const POOL_KEY_COMPONENTS = [
  { name: 'currency0',   type: 'address' },
  { name: 'currency1',   type: 'address' },
  { name: 'fee',         type: 'uint24'  },
  { name: 'tickSpacing', type: 'int24'   },
  { name: 'hooks',       type: 'address' },
] as const;

function encodeUnlockData(
  poolKey: PoolKey,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
  amount0Max: bigint,
  amount1Max: bigint,
  owner: Address,
  hasNative: boolean,
): `0x${string}` {
  const mintParams = encodeAbiParameters(
    [
      { type: 'tuple', components: POOL_KEY_COMPONENTS },
      { type: 'int24'   },
      { type: 'int24'   },
      { type: 'uint256' },   // liquidity
      { type: 'uint128' },   // amount0Max
      { type: 'uint128' },   // amount1Max
      { type: 'address' },   // owner
      { type: 'bytes'   },   // hookData
    ],
    [
      {
        currency0:   poolKey.currency0,
        currency1:   poolKey.currency1,
        fee:         poolKey.fee,
        tickSpacing: poolKey.tickSpacing,
        hooks:       poolKey.hooks,
      },
      tickLower,
      tickUpper,
      liquidity,
      amount0Max,
      amount1Max,
      owner,
      '0x',
    ],
  );

  const settlePairParams = encodeAbiParameters(
    [{ type: 'address' }, { type: 'address' }],
    [poolKey.currency0, poolKey.currency1],
  );

  let actionsBytes: `0x${string}`;
  let encParams: readonly `0x${string}`[];

  if (hasNative) {
    // SWEEP returns excess native ETH to owner (currency0 is always 0x000 for ETH pools)
    const sweepParams = encodeAbiParameters(
      [{ type: 'address' }, { type: 'address' }],
      [poolKey.currency0, owner],
    );
    actionsBytes = encodePacked(['uint8', 'uint8', 'uint8'], [0x02, 0x0d, 0x14]);
    encParams = [mintParams, settlePairParams, sweepParams];
  } else {
    actionsBytes = encodePacked(['uint8', 'uint8'], [0x02, 0x0d]);
    encParams = [mintParams, settlePairParams];
  }

  return encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes[]' }],
    [actionsBytes, encParams],
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────────

export interface AddLiquidityParams {
  poolKey: PoolKey;
  tickLower: number;
  tickUpper: number;
  amount0Desired: bigint;
  amount1Desired: bigint;
  userAddress: Address;
  /** Initial sqrtPriceX96 — required when creating a new pool */
  sqrtPriceX96?: bigint;
}

export function useAddLiquidity() {
  const chainId      = useChainId();
  const publicClient = usePublicClient();

  const [step,       setStep]       = useState(0);
  const [totalSteps, setTotalSteps] = useState(3);
  const [stepLabel,  setStepLabel]  = useState('');
  const [setupError, setSetupError] = useState<Error | null>(null);
  // Track only the final (modifyLiquidities) tx hash so success fires at the right time
  const [finalHash, setFinalHash] = useState<`0x${string}` | undefined>();

  const {
    writeContractAsync,
    isPending,
    error:    writeError,
    reset:    resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: finalHash });

  const checkPoolInitialized = useCallback(async (poolKey: PoolKey): Promise<boolean> => {
    if (!publicClient) return false;
    try {
      const slot0 = await publicClient.readContract({
        address: getStateViewAddress(chainId),
        abi: STATE_VIEW_ABI,
        functionName: 'getSlot0',
        args: [getPoolId(poolKey)],
      }) as [bigint, number, number, number];
      return slot0[0] > 0n;
    } catch {
      return false;
    }
  }, [chainId, publicClient]);

  const addLiquidity = useCallback(async (params: AddLiquidityParams) => {
    setSetupError(null);
    setStep(0);
    setStepLabel('');

    if (!publicClient) {
      setSetupError(new Error('Public client not available'));
      return;
    }

    const {
      poolKey, tickLower, tickUpper,
      amount0Desired, amount1Desired,
      userAddress, sqrtPriceX96: initialPrice,
    } = params;

    const positionManagerAddr = getPositionManagerAddress(chainId);
    const permit2Addr         = getPermit2Address(chainId);

    // ── Read current pool state ───────────────────────────────────────────────
    let poolInitialized  = false;
    let currentSqrtPrice = initialPrice ?? 0n;

    try {
      const slot0 = await publicClient.readContract({
        address: getStateViewAddress(chainId),
        abi: STATE_VIEW_ABI,
        functionName: 'getSlot0',
        args: [getPoolId(poolKey)],
      }) as [bigint, number, number, number];
      if (slot0[0] > 0n) {
        poolInitialized  = true;
        currentSqrtPrice = slot0[0];
      }
    } catch { /* pool doesn't exist yet */ }

    if (!poolInitialized && !currentSqrtPrice) {
      setSetupError(new Error('sqrtPriceX96 is required to initialize a new pool.'));
      return;
    }

    const isNative0 = isNativeEth(poolKey.currency0);
    const isNative1 = isNativeEth(poolKey.currency1);

    // ERC20 tokens needing Permit2
    const erc20Tokens: Array<{ address: Address; amount: bigint }> = [];
    if (!isNative0 && amount0Desired > 0n)
      erc20Tokens.push({ address: poolKey.currency0, amount: amount0Desired });
    if (!isNative1 && amount1Desired > 0n)
      erc20Tokens.push({ address: poolKey.currency1, amount: amount1Desired });

    setTotalSteps(erc20Tokens.length * 2 + 1);

    const deadline    = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const amount0Max  = (amount0Desired * 105n) / 100n;
    const amount1Max  = (amount1Desired * 105n) / 100n;

    // ── Step 1 per ERC20: token → Permit2 approval ────────────────────────────
    for (const { address: tokenAddr, amount } of erc20Tokens) {
      try {
        const existing = await publicClient.readContract({
          address: tokenAddr,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [userAddress, permit2Addr],
        }) as bigint;

        if (existing < amount) {
          setStep(s => s + 1);
          setStepLabel('Approving token for Permit2…');
          const tx = await writeContractAsync({
            address: tokenAddr,
            abi: erc20Abi,
            functionName: 'approve',
            args: [permit2Addr, maxUint256],
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setSetupError(new Error(`Token approval failed: ${decodeV4Error(msg) || msg.slice(0, 150)}`));
        return;
      }
    }

    // ── Step 2 per ERC20: Permit2 → PositionManager allowance ────────────────
    for (const { address: tokenAddr, amount } of erc20Tokens) {
      try {
        const [p2Amount, p2Expiry] = await publicClient.readContract({
          address: permit2Addr,
          abi: PERMIT2_ABI,
          functionName: 'allowance',
          args: [userAddress, tokenAddr, positionManagerAddr],
        }) as [bigint, number, number];

        const nowSecs = Math.floor(Date.now() / 1000);
        if (p2Amount < amount || p2Expiry < nowSecs + 120) {
          setStep(s => s + 1);
          setStepLabel('Setting up Permit2 allowance…');
          const tx = await writeContractAsync({
            address: permit2Addr,
            abi: PERMIT2_ABI,
            functionName: 'approve',
            args: [
              tokenAddr,
              positionManagerAddr,
              amount * 10n,
              BigInt(nowSecs + 3600),
            ],
          });
          await publicClient.waitForTransactionReceipt({ hash: tx });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setSetupError(new Error(`Permit2 approval failed: ${decodeV4Error(msg) || msg.slice(0, 150)}`));
        return;
      }
    }

    // ── Step 3: PositionManager.multicall([initializePool?, modifyLiquidities]) ─
    setStep(s => s + 1);
    setStepLabel(poolInitialized ? 'Adding liquidity…' : 'Initializing pool & adding liquidity…');

    try {
      const liquidity = computeLiquidityFromAmounts(
        amount0Desired, amount1Desired,
        currentSqrtPrice, tickLower, tickUpper,
      );

      if (liquidity === 0n) {
        setSetupError(new Error('Computed liquidity is zero — check amounts and price.'));
        return;
      }

      const unlockData = encodeUnlockData(
        poolKey, tickLower, tickUpper,
        liquidity, amount0Max, amount1Max,
        userAddress, isNative0 || isNative1,
      );

      const ethValue = isNative0 ? amount0Max : (isNative1 ? amount1Max : 0n);

      if (!poolInitialized) {
        // Two separate transactions to stay within block gas limits:
        // Tx A: initialize the pool
        setStepLabel('Initializing pool…');
        try {
          const initTx = await writeContractAsync({
            address: positionManagerAddr,
            abi: PositionManagerABI,
            functionName: 'initializePool',
            args: [
              {
                currency0:   poolKey.currency0,
                currency1:   poolKey.currency1,
                fee:         poolKey.fee,
                tickSpacing: poolKey.tickSpacing,
                hooks:       poolKey.hooks,
              },
              currentSqrtPrice,
            ],
          });
          await publicClient.waitForTransactionReceipt({ hash: initTx });
        } catch (initErr) {
          const initMsg = initErr instanceof Error ? initErr.message : String(initErr);
          // If pool was already initialized by a concurrent tx, continue anyway
          if (!isAlreadyInitializedError(initMsg)) {
            setSetupError(new Error(decodeV4Error(initMsg) || `Pool initialization failed: ${initMsg.slice(0, 150)}`));
            return;
          }
        }
        setStep(s => s + 1);
        setTotalSteps(t => t + 1);
      }

      // Tx B: add liquidity
      setStepLabel('Adding liquidity…');
      const modifyTx = await writeContractAsync({
        address: positionManagerAddr,
        abi: PositionManagerABI,
        functionName: 'modifyLiquidities',
        args: [unlockData, deadline],
        value: ethValue,
      });
      // Set the final hash *before* the finally block so isSuccess fires correctly
      setFinalHash(modifyTx);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isAlreadyInitializedError(msg)) {
        setSetupError(new Error('Pool already exists — liquidity will be added to the existing pool.'));
      } else {
        setSetupError(new Error(decodeV4Error(msg) || `Add liquidity failed: ${msg.slice(0, 150)}`));
      }
      console.error('[useAddLiquidity]', err);
    } finally {
      setStepLabel('');
    }
  }, [chainId, publicClient, writeContractAsync]);

  const reset = useCallback(() => {
    resetWrite();
    setSetupError(null);
    setStep(0);
    setStepLabel('');
    setFinalHash(undefined);
  }, [resetWrite]);

  const displayError = setupError ?? writeError ?? null;
  const errorMessage = displayError
    ? (() => {
        const msg = displayError instanceof Error ? displayError.message : String(displayError);
        const decoded = decodeV4Error(msg);
        return decoded ? new Error(decoded) : displayError;
      })()
    : null;

  return {
    addLiquidity,
    checkPoolInitialized,
    hash: finalHash,
    step,
    totalSteps,
    stepLabel,
    isPending: isPending || (step > 0 && !isSuccess),
    isConfirming,
    isSuccess,
    error: errorMessage,
    reset,
  };
}

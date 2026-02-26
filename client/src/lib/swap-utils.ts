/**
 * Swap Utilities for Uniswap v4 Integration
 * 
 * Handles PoolKey encoding, SwapParams building, and hook data encoding
 * for integration with PoolSwapTest contract on Base Sepolia.
 */

import { encodePacked, keccak256, type Address } from 'viem';
import { NATIVE_ETH } from '../config/tokens';
import { getV4Address } from '../config/contracts';

export function getPoolSwapTestAddress(chainId: number): Address {
  return getV4Address(chainId, 'poolSwapTest');
}

export function getPoolModifyLiquidityTestAddress(chainId: number): Address {
  return getV4Address(chainId, 'poolModifyLiquidityTest');
}

export function getPoolManagerAddress(chainId: number): Address {
  return getV4Address(chainId, 'poolManager');
}

export function getStateViewAddress(chainId: number): Address {
  return getV4Address(chainId, 'stateView');
}

/**
 * Hook contract addresses by hook type
 * 
 * DEVELOPMENT MODE: Currently using placeholder addresses.
 * To enable hook functionality:
 * 1. Deploy hook contracts to Base Sepolia
 * 2. Replace each address with the deployed contract address
 * 
 * Hook addresses must end with specific flags based on Uniswap v4 hook spec:
 * - beforeSwap: 0x01
 * - afterSwap: 0x02
 * - beforeAddLiquidity: 0x04
 * - etc.
 */
export const HOOK_ADDRESSES: { [hookId: string]: Address } = {
  'alo': '0x0000000000000000000000000000000000000000' as Address,  // Async Limit Order
  'df': '0x0000000000000000000000000000000000000000' as Address,   // Dynamic Fee
  'twamm': '0x0000000000000000000000000000000000000000' as Address, // TWAMM Rebalance
  'ym': '0x0000000000000000000000000000000000000000' as Address,   // Yield Maximizer
  'none': '0x0000000000000000000000000000000000000000' as Address,  // No hook (standard swap)
};

export function getHookAddress(hookId: string): Address {
  return HOOK_ADDRESSES[hookId] || HOOK_ADDRESSES['none'];
}

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface SwapParams {
  zeroForOne: boolean;
  amountSpecified: bigint;
  sqrtPriceLimitX96: bigint;
}

export interface SwapSettings {
  slippageTolerance: number;
  deadline: number;
}

export const FEE_TIERS = {
  LOWEST: 100,
  LOW: 500,
  MEDIUM: 3000,
  HIGH: 10000,
} as const;

export const TICK_SPACINGS: { [fee: number]: number } = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200,
};

export const SQRT_PRICE_LIMIT_X96 = {
  MIN: BigInt('4295128739'),
  MAX: BigInt('1461446703485210103287273052203988822378723970342'),
};

export function sortTokens(tokenA: Address, tokenB: Address): [Address, Address] {
  return tokenA.toLowerCase() < tokenB.toLowerCase() 
    ? [tokenA, tokenB] 
    : [tokenB, tokenA];
}

export function isNativeEth(address: Address): boolean {
  return (
    address.toLowerCase() === NATIVE_ETH.address.toLowerCase() ||
    address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
    address.toLowerCase() === '0x0000000000000000000000000000000000000000'
  );
}

export function getZeroAddress(): Address {
  return '0x0000000000000000000000000000000000000000';
}

export function getNormalizedAddress(address: Address): Address {
  return isNativeEth(address) ? getZeroAddress() : address;
}

export function createPoolKey(
  tokenA: Address,
  tokenB: Address,
  fee: number = FEE_TIERS.MEDIUM,
  hookAddress: Address = getZeroAddress()
): PoolKey {
  const normalizedA = getNormalizedAddress(tokenA);
  const normalizedB = getNormalizedAddress(tokenB);
  const [currency0, currency1] = sortTokens(normalizedA, normalizedB);
  
  const tickSpacing = TICK_SPACINGS[fee] || 60;
  
  return {
    currency0,
    currency1,
    fee,
    tickSpacing,
    hooks: hookAddress,
  };
}

export function getPoolId(poolKey: PoolKey): `0x${string}` {
  return keccak256(
    encodePacked(
      ['address', 'address', 'uint24', 'int24', 'address'],
      [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
    )
  );
}

export function createSwapParams(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  isExactInput: boolean = true
): SwapParams {
  const normalizedIn = getNormalizedAddress(tokenIn);
  const normalizedOut = getNormalizedAddress(tokenOut);
  const [currency0] = sortTokens(normalizedIn, normalizedOut);
  
  const zeroForOne = normalizedIn.toLowerCase() === currency0.toLowerCase();
  
  // Uniswap v4: negative amountSpecified = exact input, positive = exact output
  const amountSpecified = isExactInput ? -amountIn : amountIn;
  
  const sqrtPriceLimitX96 = zeroForOne 
    ? SQRT_PRICE_LIMIT_X96.MIN + BigInt(1)
    : SQRT_PRICE_LIMIT_X96.MAX - BigInt(1);
  
  return {
    zeroForOne,
    amountSpecified,
    sqrtPriceLimitX96,
  };
}

export function encodeHookData(hookId: string, additionalData?: `0x${string}`): `0x${string}` {
  if (!hookId || hookId === 'none') {
    return '0x';
  }
  
  if (additionalData) {
    return additionalData;
  }
  
  return '0x';
}

export function calculateMinimumReceived(
  expectedOutput: bigint,
  slippageTolerance: number
): bigint {
  const slippageBps = BigInt(Math.floor(slippageTolerance * 100));
  const minOutput = (expectedOutput * (BigInt(10000) - slippageBps)) / BigInt(10000);
  return minOutput;
}

export function calculatePriceImpact(
  inputAmount: bigint,
  outputAmount: bigint,
  spotPrice: bigint,
  inputDecimals: number,
  outputDecimals: number
): number {
  if (inputAmount === BigInt(0) || spotPrice === BigInt(0)) {
    return 0;
  }

  const expectedOutput = (inputAmount * spotPrice * BigInt(10 ** outputDecimals)) /
    (BigInt(10 ** inputDecimals) * BigInt(10 ** 18));

  if (expectedOutput === BigInt(0)) {
    return 0;
  }

  const feeImpact = Number(((expectedOutput - outputAmount) * BigInt(1000000)) / expectedOutput) / 10000;

  const SIMULATED_POOL_RESERVE_USD = 500_000;
  let ammImpact = 0;
  try {
    const inputScaled = Number(inputAmount / BigInt(10 ** Math.max(0, inputDecimals - 6)));
    const spotScaled = Number(spotPrice / BigInt(10 ** 12));
    const inputUsd = (inputScaled * spotScaled) / 1e12;
    if (isFinite(inputUsd) && inputUsd > 0) {
      ammImpact = (inputUsd / SIMULATED_POOL_RESERVE_USD) * 100;
    }
  } catch {
    ammImpact = 0;
  }

  const totalImpact = feeImpact + ammImpact;
  if (!isFinite(totalImpact) || isNaN(totalImpact)) return 0.0025;
  return Math.max(0.0025, totalImpact);
}

export function formatTokenAmount(amount: bigint, decimals: number, isStablecoin: boolean = false): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  
  const displayDecimals = isStablecoin ? 2 : 6;
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, displayDecimals).replace(/0+$/, '');
  
  if (fractionStr) {
    return `${whole}.${fractionStr}`;
  }
  if (isStablecoin) {
    return `${whole}.00`;
  }
  return whole.toString();
}

export function formatDisplayAmount(value: number, symbol: string): string {
  const stableSymbols = new Set(['USDC', 'EURC']);
  const isStable = stableSymbols.has(symbol);
  
  if (isStable) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  
  if (value < 0.01 && value > 0) {
    return value.toFixed(6);
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

export function parseTokenAmount(amount: string, decimals: number): bigint {
  if (!amount || amount === '') return BigInt(0);
  
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  
  return BigInt(whole + paddedFraction);
}

export function getDeadline(minutes: number = 20): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + minutes * 60);
}

export const POOL_SWAP_TEST_ABI = [
  {
    name: 'swap',
    type: 'function',
    stateMutability: 'payable',
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
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'zeroForOne', type: 'bool' },
          { name: 'amountSpecified', type: 'int256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
      { name: 'testSettings', type: 'tuple', components: [
        { name: 'takeClaims', type: 'bool' },
        { name: 'settleUsingBurn', type: 'bool' },
      ]},
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [{ name: 'delta', type: 'int256' }],
  },
] as const;

export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

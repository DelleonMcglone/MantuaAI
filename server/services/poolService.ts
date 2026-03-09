/**
 * poolService.ts
 * Creates Uniswap v4 pools and executes swaps on Base Sepolia using viem.
 *
 * StableProtectionHook deployed on Base Sepolia:
 *   Address:    0xB5faDA071CD56b3F56632F6771356C3e3834a0C0
 *   Pool ID:    0xebd28cb004582a08c0afe15680d7c6e86de9e3950d237e410c4c0e8b6354d696
 *   Pool Key:   USDC/EURC, fee=0x800000 (DYNAMIC_FEE_FLAG), tickSpacing=1
 *
 * The hook enforces:
 *   - 5-zone peg monitoring (HEALTHY→CRITICAL)
 *   - Dynamic fees: 0.5× for peg-restoring swaps, 3× for peg-worsening swaps
 *   - Circuit breaker: blocks swaps when deviation > 5%
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  getAddress,
  erc20Abi,
  parseUnits,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { readFileSync } from "fs";

const RPC_URL      = "https://sepolia.base.org";
const BASESCAN     = "https://sepolia.basescan.org/tx/";

// Base Sepolia addresses
const POOL_MANAGER_ADDRESS  = "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408" as `0x${string}`;
const STABLE_HOOK_ADDRESS   = "0xB5faDA071CD56b3F56632F6771356C3e3834a0C0" as `0x${string}`;
const POOL_SWAP_TEST        = "0x8b5bcc363dde2614281ad875bad385e0a785d3b9" as `0x${string}`;
const USDC_ADDR             = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;
const EURC_ADDR             = "0x808456652fdb597867f38412077A9182bf77359F" as `0x${string}`;

// Uniswap v4 constants
const DYNAMIC_FEE_FLAG  = 0x800000;   // LPFeeLibrary.DYNAMIC_FEE_FLAG
const SQRT_PRICE_1_1    = 79228162514264337593543950336n;
const MIN_SQRT_PRICE_LIMIT = 4295128740n; // TickMath.MIN_SQRT_PRICE + 1

const POOL_MANAGER_ABI = parseAbi([
  "function initialize((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) external returns (int24 tick)",
]);

const SWAP_ABI = parseAbi([
  "function swap((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key,(bool zeroForOne,int256 amountSpecified,uint160 sqrtPriceLimitX96) params,(bool takeClaims,bool settleUsingBurn) testSettings,bytes hookData) external payable returns (int256 delta)",
]);

// Canonical pool key (USDC < EURC by address comparison)
function getStablePoolKey() {
  const [currency0, currency1] = getAddress(USDC_ADDR) < getAddress(EURC_ADDR)
    ? [USDC_ADDR, EURC_ADDR]
    : [EURC_ADDR, USDC_ADDR];
  return { currency0, currency1, fee: DYNAMIC_FEE_FLAG, tickSpacing: 1, hooks: STABLE_HOOK_ADDRESS };
}

// Compute pool ID from pool key
export function getStablePoolId(): string {
  const pk = getStablePoolKey();
  const enc = encodeAbiParameters(
    parseAbiParameters("address, address, uint24, int24, address"),
    [pk.currency0, pk.currency1, pk.fee, pk.tickSpacing, pk.hooks]
  );
  return keccak256(enc);
}

// Load agent wallet private key (from docs/agent-wallet.json or env)
function getPrivateKey(): `0x${string}` {
  // Try env first
  const envKey = process.env.AGENT_PRIVATE_KEY ?? process.env.CDP_AGENT_PRIVATE_KEY;
  if (envKey?.startsWith("0x")) return envKey as `0x${string}`;

  // Fall back to docs/agent-wallet.json
  try {
    const walletData = JSON.parse(readFileSync("docs/agent-wallet.json", "utf8"));
    if (walletData.privateKey?.startsWith("0x")) return walletData.privateKey as `0x${string}`;
  } catch { /* file not found */ }

  throw new Error(
    "No agent private key found. Set AGENT_PRIVATE_KEY env var or ensure docs/agent-wallet.json exists."
  );
}

export interface PoolCreationResult {
  transactionHash: string;
  explorerUrl: string;
  poolId: string;
  poolKey: {
    currency0: string;
    currency1: string;
    fee: number;
    tickSpacing: number;
    hooks: string;
  };
}

export interface SwapResult {
  transactionHash: string;
  explorerUrl: string;
  fromToken: string;
  toToken: string;
  amountIn: string;
}

/**
 * Create (or verify) the USDC/EURC Stable Protection pool on Base Sepolia.
 * If the pool already exists, returns the existing pool info.
 */
export async function createStableProtectionPool(): Promise<PoolCreationResult> {
  const privateKey = getPrivateKey();
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC_URL) });

  const poolKey = getStablePoolKey();
  const poolId  = getStablePoolId();

  let hash: `0x${string}`;
  try {
    hash = await walletClient.writeContract({
      address: POOL_MANAGER_ADDRESS,
      abi: POOL_MANAGER_ABI,
      functionName: "initialize",
      args: [poolKey, SQRT_PRICE_1_1],
    });
    const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
    await publicClient.waitForTransactionReceipt({ hash });
  } catch (e: any) {
    const msg = e.shortMessage ?? e.message ?? String(e);
    // Pool already initialized — return existing info
    if (msg.includes("AlreadyInitialized") || msg.includes("PoolAlreadyInitialized") || msg.includes("0x7983c051")) {
      return {
        transactionHash: "pool-already-exists",
        explorerUrl: `https://sepolia.basescan.org/address/${POOL_MANAGER_ADDRESS}`,
        poolId,
        poolKey: { ...poolKey, fee: poolKey.fee },
      };
    }
    throw e;
  }

  return {
    transactionHash: hash,
    explorerUrl: `${BASESCAN}${hash}`,
    poolId,
    poolKey: { ...poolKey },
  };
}

/**
 * Swap USDC → EURC (or EURC → USDC) via the Stable Protection pool.
 * Amount is in human-readable units (e.g., "1" = 1 USDC).
 */
export async function swapViaStablePool(
  fromToken: "USDC" | "EURC",
  amount: string
): Promise<SwapResult> {
  const privateKey = getPrivateKey();
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC_URL) });
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

  const poolKey = getStablePoolKey();
  const tokenIn  = fromToken === "USDC" ? USDC_ADDR : EURC_ADDR;
  const toToken  = fromToken === "USDC" ? "EURC" : "USDC";
  const amountIn = parseUnits(amount, 6); // USDC and EURC both 6 decimals

  // Determine swap direction based on pool key ordering
  const zeroForOne = getAddress(tokenIn) === getAddress(poolKey.currency0);

  // Step 1: Approve token to PoolSwapTest
  const approveTx = await walletClient.writeContract({
    address: tokenIn,
    abi: erc20Abi,
    functionName: "approve",
    args: [POOL_SWAP_TEST, amountIn],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });

  // Step 2: Execute swap (exact-input, negative amountSpecified = exact input)
  const swapTx = await walletClient.writeContract({
    address: POOL_SWAP_TEST,
    abi: SWAP_ABI,
    functionName: "swap",
    args: [
      poolKey,
      { zeroForOne, amountSpecified: -amountIn, sqrtPriceLimitX96: MIN_SQRT_PRICE_LIMIT },
      { takeClaims: false, settleUsingBurn: false },
      "0x" as `0x${string}`,
    ],
    value: 0n,
  });
  await publicClient.waitForTransactionReceipt({ hash: swapTx });

  return {
    transactionHash: swapTx,
    explorerUrl: `${BASESCAN}${swapTx}`,
    fromToken,
    toToken,
    amountIn: amount,
  };
}

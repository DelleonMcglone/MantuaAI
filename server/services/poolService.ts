/**
 * poolService.ts
 * Creates Uniswap v4 pools on Unichain Sepolia using viem.
 * Specifically creates the USDC/EURC pool with Stable Protection Hook.
 *
 * The Stable Protection Hook requires:
 *   - fee = 0x800000 (DYNAMIC_FEE_FLAG)
 *   - tickSpacing = 1
 *   - Hook deployed on Unichain Sepolia (from stableprotection-hook repo)
 */

import { createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Unichain Sepolia chain definition
const UNICHAIN_SEPOLIA = {
  id: 1301,
  name: "Unichain Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia.unichain.org"] } },
} as const;

const POOL_MANAGER_ADDRESS = "0x00b036b58a818b1bc34d502d3fe730db729e62ac" as `0x${string}`;
// USDC on Unichain Sepolia
const USDC_UNICHAIN = "0x31d0220469e10c4E71834a79b1f276d740d3768F" as `0x${string}`;

const POOL_MANAGER_ABI = parseAbi([
  "function initialize((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) external returns (int24 tick)",
]);

// sqrtPriceX96 for 1:1 ratio (USDC/EURC at peg)
// = sqrt(1) * 2^96 = 79228162514264337593543950336
const SQRT_PRICE_1_1 = 79228162514264337593543950336n;
const DYNAMIC_FEE_FLAG = 0x800000;

export interface PoolCreationResult {
  transactionHash: string;
  explorerUrl: string;
  poolKey: {
    currency0: string;
    currency1: string;
    fee: number;
    tickSpacing: number;
    hooks: string;
  };
}

export async function createStableProtectionPool(): Promise<PoolCreationResult> {
  const hookAddress = process.env.STABLE_PROTECTION_HOOK_ADDRESS;
  if (!hookAddress || !hookAddress.startsWith("0x")) {
    throw new Error(
      "STABLE_PROTECTION_HOOK_ADDRESS env var is not set. " +
      "Get the deployed hook address from the stableprotection-hook repo README."
    );
  }

  // CDP_AGENT_PRIVATE_KEY is used for direct viem transactions.
  // Export it from your CDP wallet dashboard or use CDP_WALLET_SECRET
  // if it is formatted as a hex private key.
  const privateKey = (process.env.CDP_AGENT_PRIVATE_KEY ?? process.env.CDP_WALLET_SECRET) as `0x${string}`;
  if (!privateKey || !privateKey.startsWith("0x")) {
    throw new Error(
      "CDP_AGENT_PRIVATE_KEY must be set (hex private key starting with 0x) " +
      "for direct viem transactions. Export it from your CDP wallet dashboard."
    );
  }

  const account = privateKeyToAccount(privateKey);

  const walletClient = createWalletClient({
    account,
    chain: UNICHAIN_SEPOLIA,
    transport: http("https://sepolia.unichain.org"),
  });

  const hookAddr = hookAddress as `0x${string}`;

  // Sort currency addresses — Uniswap v4 requires currency0 < currency1 (lexicographic)
  const addrs: [`0x${string}`, `0x${string}`] =
    USDC_UNICHAIN.toLowerCase() < hookAddr.toLowerCase()
      ? [USDC_UNICHAIN, hookAddr]
      : [hookAddr, USDC_UNICHAIN];

  const [currency0, currency1] = addrs;

  const poolKey = {
    currency0,
    currency1,
    fee: DYNAMIC_FEE_FLAG,
    tickSpacing: 1,
    hooks: hookAddr,
  };

  const hash = await walletClient.writeContract({
    address: POOL_MANAGER_ADDRESS,
    abi: POOL_MANAGER_ABI,
    functionName: "initialize",
    args: [poolKey, SQRT_PRICE_1_1],
  });

  return {
    transactionHash: hash,
    explorerUrl: `https://sepolia.uniscan.xyz/tx/${hash}`,
    poolKey: {
      currency0,
      currency1,
      fee: DYNAMIC_FEE_FLAG,
      tickSpacing: 1,
      hooks: hookAddr,
    },
  };
}

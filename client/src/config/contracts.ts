/**
 * Verified Uniswap v4 contract addresses
 *
 * Base Sepolia (84532):
 *   Source: https://docs.uniswap.org/contracts/v4/deployments
 *   Last verified: 2026-02-27
 *
 * Unichain Sepolia (1301):
 *   Source: https://docs.uniswap.org/contracts/v4/deployments
 *   Last verified: 2026-03-04
 */
import type { Address } from 'viem';

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const UNICHAIN_SEPOLIA_CHAIN_ID = 1301;

export const UNISWAP_V4_ADDRESSES = {
  // Core
  poolManager:              '0x05e73354cfdd6745c338b50bcfdfa3aa6fa03408' as Address,
  stateView:                '0x571291b572ed32ce6751a2cb2486ebee8defb9b4' as Address,
  // Production periphery
  positionManager:          '0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80' as Address,
  universalRouter:          '0x492e6456d9528771018deb9e87ef7750ef184104' as Address,
  quoter:                   '0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba' as Address,
  permit2:                  '0x000000000022d473030f116ddee9f6b43ac78ba3' as Address,
  // Test helpers
  poolSwapTest:             '0x8b5bcc363dde2614281ad875bad385e0a785d3b9' as Address,
  poolModifyLiquidityTest:  '0x37429cd17cb1454c34e7f50b09725202fd533039' as Address,
};

// Unichain Sepolia V4 addresses
// Source: https://docs.uniswap.org/contracts/v4/deployments
export const UNISWAP_V4_ADDRESSES_UNICHAIN_SEPOLIA = {
  poolManager:              '0x00b036b58a818b1bc34d502d3fe730db729e62ac' as Address,
  stateView:                '0xc199f1072a74d4e905aba1a84d9a45e2546b6222' as Address,
  positionManager:          '0xf969aee60879c54baaed9f3ed26147db216fd664' as Address,
  universalRouter:          '0xf70536b3bcc1bd1a972dc186a2cf84cc6da6be5d' as Address,
  quoter:                   '0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472' as Address,
  permit2:                  '0x000000000022d473030f116ddee9f6b43ac78ba3' as Address,
  // Test helpers (same pattern as Base Sepolia)
  poolSwapTest:             '0x9140a78c1a137c7ff1c151ec8231272af78a99a4' as Address,
  poolModifyLiquidityTest:  '0x5fa728c0a5cfd51bee4b060773f50554c0c8a7ab' as Address,
};

export const STABLE_PROTECTION_HOOK_ADDRESSES: Record<number, Address> = {
  [BASE_SEPOLIA_CHAIN_ID]: '0x0000000000000000000000000000000000000000' as Address,
  [UNICHAIN_SEPOLIA_CHAIN_ID]: '0x1510926ba6986cb3c93BFFF25839C0ef740820c0' as Address,
};

export function getStableProtectionHookAddress(chainId: number): Address {
  return STABLE_PROTECTION_HOOK_ADDRESSES[chainId] ?? '0x0000000000000000000000000000000000000000' as Address;
}

export const UNISWAP_V4_ADDRESSES_BY_CHAIN: Record<number, typeof UNISWAP_V4_ADDRESSES> = {
  [BASE_SEPOLIA_CHAIN_ID]:    UNISWAP_V4_ADDRESSES,
  [UNICHAIN_SEPOLIA_CHAIN_ID]: UNISWAP_V4_ADDRESSES_UNICHAIN_SEPOLIA,
};

export function getV4Address(
  chainId: number,
  contract: keyof typeof UNISWAP_V4_ADDRESSES
): Address {
  const addresses = UNISWAP_V4_ADDRESSES_BY_CHAIN[chainId] ?? UNISWAP_V4_ADDRESSES;
  return addresses[contract];
}

// ─── Block Explorers ────────────────────────────────────────────────────────

export const EXPLORERS: Record<number, string> = {
  [BASE_SEPOLIA_CHAIN_ID]:    'https://sepolia.basescan.org',
  [UNICHAIN_SEPOLIA_CHAIN_ID]: 'https://sepolia.uniscan.xyz',
};

export const EXPLORER_BASE = EXPLORERS[BASE_SEPOLIA_CHAIN_ID];

export function getExplorerBase(chainId?: number): string {
  return EXPLORERS[chainId ?? BASE_SEPOLIA_CHAIN_ID] ?? EXPLORER_BASE;
}

export function getExplorerTxUrl(txHash: string, chainId?: number): string {
  return `${getExplorerBase(chainId)}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string, chainId?: number): string {
  return `${getExplorerBase(chainId)}/address/${address}`;
}

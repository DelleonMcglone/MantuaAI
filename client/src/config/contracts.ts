/**
 * Verified Uniswap v4 contract addresses for Base Sepolia (Chain ID: 84532)
 * Source: https://docs.uniswap.org/contracts/v4/deployments
 * Last verified: 2026-02-27
 */
import type { Address } from 'viem';

export const BASE_SEPOLIA_CHAIN_ID = 84532;

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

export function getV4Address(
  _chainId: number,
  contract: keyof typeof UNISWAP_V4_ADDRESSES
): Address {
  return UNISWAP_V4_ADDRESSES[contract];
}

export const EXPLORER_BASE = 'https://sepolia.basescan.org';

export function getExplorerTxUrl(txHash: string, _chainId?: number): string {
  return `${EXPLORER_BASE}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string): string {
  return `${EXPLORER_BASE}/address/${address}`;
}

// Legacy compatibility shims
export const EXPLORERS: Record<number, string> = { 84532: EXPLORER_BASE };
export const UNISWAP_V4_ADDRESSES_BY_CHAIN = { [84532]: UNISWAP_V4_ADDRESSES };

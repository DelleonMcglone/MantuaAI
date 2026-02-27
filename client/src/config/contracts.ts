import type { Address } from 'viem';

export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const UNISWAP_V4_ADDRESSES = {
  poolManager:              '0x05e73354cfdd6745c338b50bcfdfa3aa6fa03408' as Address,
  stateView:                '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71' as Address,
  poolSwapTest:             '0x8b5bcc363dde2614281ad875bad385e0a785d3b9' as Address,
  poolModifyLiquidityTest:  '0x4b69e8d500d7c48285c8b4abbe41dfa5303a8982' as Address,
  quoter:                   '0x0d5e0f971ed27fbff6c2837bf31316121532048d' as Address,
};

export function getV4Address(
  _chainId: number,
  contract: keyof typeof UNISWAP_V4_ADDRESSES
): Address {
  return UNISWAP_V4_ADDRESSES[contract];
}

export const EXPLORER_BASE = 'https://sepolia.basescan.org';

export function getExplorerTxUrl(txHash: string): string {
  return `${EXPLORER_BASE}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string): string {
  return `${EXPLORER_BASE}/address/${address}`;
}

// Legacy compatibility shim
export const EXPLORERS: Record<number, string> = { 84532: EXPLORER_BASE };
export const UNISWAP_V4_ADDRESSES_BY_CHAIN = { [84532]: UNISWAP_V4_ADDRESSES };

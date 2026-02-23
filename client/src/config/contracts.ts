import type { Address } from 'viem';

export type SupportedChainId = 84532 | 1301;

export const UNISWAP_V4_ADDRESSES: Record<SupportedChainId, {
  poolManager: Address;
  stateView: Address;
  poolSwapTest: Address;
  poolModifyLiquidityTest: Address;
  quoter: Address;
}> = {
  84532: {
    poolManager: '0x498581fF718922C3f8e6A244956af099b2652B2B' as Address,
    stateView: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71' as Address,
    poolSwapTest: '0x8b5bcc363dde2614281ad875bad385e0a785d3b9' as Address,
    poolModifyLiquidityTest: '0x4b69e8d500d7c48285c8b4abbe41dfa5303a8982' as Address,
    quoter: '0x0d5e0f971ed27fbff6c2837bf31316121532048d' as Address,
  },
  1301: {
    poolManager: '0x00b036b58a818b1bc34d502d3fe730db729e62ac' as Address,
    stateView: '0xc199f1072a74d4e905aba1a84d9a45e2546b6222' as Address,
    poolSwapTest: '0x9140a78c1a137c7ff1c151ec8231272af78a99a4' as Address,
    poolModifyLiquidityTest: '0x5fa728c0a5cfd51bee4b060773f50554c0c8a7ab' as Address,
    quoter: '0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472' as Address,
  },
};

export function getV4Address(chainId: number, contract: keyof typeof UNISWAP_V4_ADDRESSES[SupportedChainId]): Address {
  const chain = UNISWAP_V4_ADDRESSES[chainId as SupportedChainId];
  if (!chain) {
    throw new Error(`Chain ${chainId} not supported. Use Base Sepolia (84532) or Unichain Sepolia (1301).`);
  }
  return chain[contract];
}

export const EXPLORERS: Record<number, string> = {
  84532: 'https://sepolia.basescan.org',
  1301: 'https://sepolia.uniscan.xyz',
};

export function getExplorerTxUrl(txHash: string, chainId: number): string {
  const explorer = EXPLORERS[chainId] || EXPLORERS[84532];
  return `${explorer}/tx/${txHash}`;
}

export const CONTRACTS = {
  VAULTS: {
    'eth-usdc-lp': {
      84532: '0x0000000000000000000000000000000000000000' as Address,
      1301:  '0x0000000000000000000000000000000000000000' as Address,
    },
    'usdc-usdt-stable': {
      84532: '0x0000000000000000000000000000000000000000' as Address,
      1301:  '0x0000000000000000000000000000000000000000' as Address,
    },
    'eth-btc-lp': {
      84532: '0x0000000000000000000000000000000000000000' as Address,
      1301:  '0x0000000000000000000000000000000000000000' as Address,
    },
    'ai-multi-strategy': {
      84532: '0x0000000000000000000000000000000000000000' as Address,
      1301:  '0x0000000000000000000000000000000000000000' as Address,
    },
  },
} as const;

export type VaultId = keyof typeof CONTRACTS.VAULTS;

export function getVaultAddress(vaultId: VaultId, chainId: number): Address | undefined {
  const chain = CONTRACTS.VAULTS[vaultId];
  if (!chain) return undefined;
  return chain[chainId as SupportedChainId];
}

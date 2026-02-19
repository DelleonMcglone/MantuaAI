/**
 * contracts.ts
 * On-chain contract addresses keyed by chain ID.
 * Update entries after deployment.
 */

import type { Address } from 'viem';

export const CONTRACTS = {
  /**
   * MantuaPredictionMarket — binary prediction market settling in mock USDC.
   * Deploy with: cd contracts/prediction && forge script script/DeployBaseSepolia.s.sol ...
   * Paste deployed addresses below after running deployment scripts.
   */
  MANTUA_PREDICTION_MARKET: {
    84532: '0x0000000000000000000000000000000000000000' as Address, // Base Sepolia — update after deploy
    1301:  '0x0000000000000000000000000000000000000000' as Address, // Unichain Sepolia — update after deploy
  },

  /**
   * MantuaVault — ERC-4626 yield vaults (four instances per chain).
   * Deploy with: cd contracts/vaults && forge script script/DeployBaseSepolia.s.sol ...
   * Keys: vault id → chainId → address
   */
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

export type SupportedChainId = keyof typeof CONTRACTS.MANTUA_PREDICTION_MARKET;
export type VaultId          = keyof typeof CONTRACTS.VAULTS;

export function getPredictionMarketAddress(chainId: number): Address | undefined {
  return CONTRACTS.MANTUA_PREDICTION_MARKET[chainId as SupportedChainId];
}

export function getVaultAddress(vaultId: VaultId, chainId: number): Address | undefined {
  const chain = CONTRACTS.VAULTS[vaultId];
  if (!chain) return undefined;
  return chain[chainId as SupportedChainId];
}

/**
 * contracts.ts
 * On-chain contract addresses keyed by chain ID.
 * Update MANTUA_PREDICTION_MARKET entries after deployment.
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
} as const;

export type SupportedChainId = keyof typeof CONTRACTS.MANTUA_PREDICTION_MARKET;

export function getPredictionMarketAddress(chainId: number): Address | undefined {
  return CONTRACTS.MANTUA_PREDICTION_MARKET[chainId as SupportedChainId];
}

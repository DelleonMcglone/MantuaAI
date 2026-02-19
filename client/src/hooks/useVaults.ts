/**
 * useVaults.ts
 * Batch-reads on-chain state for all four MantuaVault instances.
 * Returns live TVL, APY, share price, and user balance for each vault.
 */

import { useReadContracts, useAccount, useChainId } from 'wagmi';
import { formatUnits }                               from 'viem';
import MantuaVaultABI                                from '../abis/MantuaVault.json';
import { VAULT_CONFIGS, type VaultConfig }           from '../config/vaults.ts';
import type { Address }                              from 'viem';

export interface VaultData extends VaultConfig {
  /** Total assets (LP tokens) deposited — in human units */
  totalAssetsFormatted: string;
  /** Total vault shares outstanding */
  totalSupplyFormatted: string;
  /** Price per share in human units */
  pricePerShare: number;
  /** APY in basis points read from contract (falls back to config) */
  liveApyBps: number;
  /** Whether the vault is paused */
  isPaused: boolean;
  /** Connected user's share balance */
  userShares: bigint;
  /** Connected user's share balance converted to underlying assets */
  userAssetsFormatted: string;
  /** Contract address for the current chain */
  contractAddress: Address | undefined;
  /** Underlying asset address for the current chain */
  assetAddress: Address | undefined;
}

export function useVaults(): { vaults: VaultData[]; isLoading: boolean } {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();

  // Build multicall contracts array.
  // Per vault: getVaultStats() + (if connected) balanceOf(user)
  // stride = 2 if disconnected (stats only), stride = 2 + 1 = 3 if connected
  const STRIDE = isConnected ? 3 : 2;

  const contracts = VAULT_CONFIGS.flatMap(vault => {
    const addr = vault.addresses[chainId as keyof typeof vault.addresses];
    if (!addr || addr === '0x0000000000000000000000000000000000000000') {
      return [];
    }
    const base = [
      {
        address:      addr,
        abi:          MantuaVaultABI as any,
        functionName: 'getVaultStats',
        args:         [],
      },
      {
        address:      addr,
        abi:          MantuaVaultABI as any,
        functionName: 'totalSupply',
        args:         [],
      },
    ] as const;

    if (isConnected && userAddress) {
      return [
        ...base,
        {
          address:      addr,
          abi:          MantuaVaultABI as any,
          functionName: 'balanceOf',
          args:         [userAddress],
        },
      ] as const;
    }
    return base;
  });

  const { data, isLoading } = useReadContracts({
    contracts: contracts as any[],
    query: { enabled: contracts.length > 0 },
  });

  const vaults: VaultData[] = VAULT_CONFIGS.map((vault, i) => {
    const addr       = vault.addresses[chainId as keyof typeof vault.addresses];
    const assetAddr  = vault.assetAddresses[chainId as keyof typeof vault.assetAddresses];
    const isZero     = !addr || addr === '0x0000000000000000000000000000000000000000';

    // Default values when contract not deployed / not readable
    if (isZero || !data) {
      return {
        ...vault,
        totalAssetsFormatted: '0',
        totalSupplyFormatted: '0',
        pricePerShare:        1,
        liveApyBps:           vault.apyBps,
        isPaused:             false,
        userShares:           0n,
        userAssetsFormatted:  '0',
        contractAddress:      addr,
        assetAddress:         assetAddr,
      };
    }

    const offset = i * STRIDE;
    const statsRes = data[offset];
    const supplyRes = data[offset + 1];
    const balanceRes = isConnected ? data[offset + 2] : undefined;

    // getVaultStats returns tuple [totalAssets, totalSupply, pricePerShare, apyBps, paused]
    const stats = statsRes?.status === 'success'
      ? (statsRes.result as [bigint, bigint, bigint, bigint, boolean])
      : null;

    const totalAssets   = stats?.[0] ?? 0n;
    const totalSupply   = stats?.[1] ?? 0n;
    const pricePerShare = stats?.[2] ?? 1000000000000000000n; // 1e18
    const liveApyBps    = stats?.[3] ? Number(stats[3]) : vault.apyBps;
    const isPaused      = stats?.[4] ?? false;

    const userShares    = (balanceRes?.status === 'success'
      ? (balanceRes.result as bigint)
      : 0n) ?? 0n;

    // Convert user shares to assets: shares * pricePerShare / 1e18
    const userAssetsRaw = (userShares * pricePerShare) / 1_000_000_000_000_000_000n;

    return {
      ...vault,
      totalAssetsFormatted: formatUnits(totalAssets, 18),
      totalSupplyFormatted: formatUnits(totalSupply, 18),
      pricePerShare:        Number(formatUnits(pricePerShare, 18)),
      liveApyBps,
      isPaused,
      userShares,
      userAssetsFormatted:  formatUnits(userAssetsRaw, 18),
      contractAddress:      addr,
      assetAddress:         assetAddr,
    };
  });

  return { vaults, isLoading };
}

/**
 * vaults.ts
 * Static configuration for the four MantuaVault instances.
 * Update `addresses` entries after contract deployment.
 */

import type { Address } from 'viem';

export type VaultStrategy = 'stable' | 'lp' | 'multi';
export type VaultRisk     = 'low' | 'medium' | 'high';

export interface VaultConfig {
  /** Unique vault key used as React key / URL slug */
  id:          string;
  /** Human-readable vault name shown in the UI */
  name:        string;
  /** Short description shown on the card */
  description: string;
  /** ERC-4626 vault contract addresses keyed by chainId */
  addresses: {
    84532?: Address; // Base Sepolia
    1301?:  Address; // Unichain Sepolia
  };
  /** Underlying LP token addresses keyed by chainId (for approval) */
  assetAddresses: {
    84532?: Address;
    1301?:  Address;
  };
  /** Token pair e.g. "ETH / mUSDC" */
  pair:        string;
  /** APY in basis points (e.g. 1240 = 12.40%) */
  apyBps:      number;
  /** Strategy type */
  strategy:    VaultStrategy;
  /** Risk level */
  risk:        VaultRisk;
  /** Share token symbol e.g. "mV-ETH-USDC" */
  shareSymbol: string;
  /** Underlying asset symbol */
  assetSymbol: string;
}

export const VAULT_CONFIGS: VaultConfig[] = [
  {
    id:          'eth-usdc-lp',
    name:        'ETH/mUSDC LP Vault',
    description: 'Earns trading fees from the ETH/mUSDC Uniswap v4 pool on Mantua.',
    addresses:   { 84532: '0x0000000000000000000000000000000000000000', 1301: '0x0000000000000000000000000000000000000000' },
    assetAddresses: { 84532: '0x0000000000000000000000000000000000000000', 1301: '0x0000000000000000000000000000000000000000' },
    pair:        'ETH / mUSDC',
    apyBps:      1240,
    strategy:    'lp',
    risk:        'medium',
    shareSymbol: 'mV-ETH-USDC',
    assetSymbol: 'ETH/mUSDC LP',
  },
  {
    id:          'usdc-usdt-stable',
    name:        'mUSDC/mUSDT Stable Vault',
    description: 'Low-volatility stable pair vault. Earns yield from correlated asset swaps.',
    addresses:   { 84532: '0x0000000000000000000000000000000000000000', 1301: '0x0000000000000000000000000000000000000000' },
    assetAddresses: { 84532: '0x0000000000000000000000000000000000000000', 1301: '0x0000000000000000000000000000000000000000' },
    pair:        'mUSDC / mUSDT',
    apyBps:      810,
    strategy:    'stable',
    risk:        'low',
    shareSymbol: 'mV-STABLE',
    assetSymbol: 'mUSDC/mUSDT LP',
  },
  {
    id:          'eth-btc-lp',
    name:        'ETH/mBTC LP Vault',
    description: 'High-volume crypto pair. Earns trading fees from ETH/BTC swaps.',
    addresses:   { 84532: '0x0000000000000000000000000000000000000000', 1301: '0x0000000000000000000000000000000000000000' },
    assetAddresses: { 84532: '0x0000000000000000000000000000000000000000', 1301: '0x0000000000000000000000000000000000000000' },
    pair:        'ETH / mBTC',
    apyBps:      1870,
    strategy:    'lp',
    risk:        'high',
    shareSymbol: 'mV-ETH-BTC',
    assetSymbol: 'ETH/mBTC LP',
  },
  {
    id:          'ai-multi-strategy',
    name:        'AI-Managed Multi-Strategy Vault',
    description: 'Mantua AI dynamically reallocates capital across the highest-APY pools.',
    addresses:   { 84532: '0x0000000000000000000000000000000000000000', 1301: '0x0000000000000000000000000000000000000000' },
    assetAddresses: { 84532: '0x0000000000000000000000000000000000000000', 1301: '0x0000000000000000000000000000000000000000' },
    pair:        'Multi-Asset',
    apyBps:      2420,
    strategy:    'multi',
    risk:        'high',
    shareSymbol: 'mV-MULTI',
    assetSymbol: 'Multi-LP',
  },
];

/** APY from basis points → formatted string (e.g. "12.40%") */
export const formatApy = (bps: number): string =>
  `${(bps / 100).toFixed(2)}%`;

/** Average APY across all vaults */
export const avgApyBps = (): number =>
  Math.round(VAULT_CONFIGS.reduce((s, v) => s + v.apyBps, 0) / VAULT_CONFIGS.length);

/** Get vault config by id */
export const getVaultById = (id: string): VaultConfig | undefined =>
  VAULT_CONFIGS.find(v => v.id === id);

/** Strategy label → display string */
export const STRATEGY_LABELS: Record<VaultStrategy, string> = {
  stable: 'Stable',
  lp:     'LP',
  multi:  'Multi',
};

/** Risk level → display colour classes (Tailwind) */
export const RISK_COLORS: Record<VaultRisk, string> = {
  low:    'text-emerald-400 bg-emerald-900/30 border-emerald-700/50',
  medium: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50',
  high:   'text-red-400 bg-red-900/30 border-red-700/50',
};

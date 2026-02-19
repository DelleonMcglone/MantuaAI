/**
 * Shared types for the voice command parser.
 * Imported by both the server and the React client.
 */

export type HookType = 'stable-protection' | 'jit' | 'mev-protection';

export interface SwapCommand {
  type: 'swap';
  fromToken: string;
  toToken: string;
  amount: string;
  hook?: HookType;
}

export interface LiquidityCommand {
  type: 'liquidity';
  action: 'add' | 'remove';
  token0: string;
  token1: string;
  amount0?: string;
  amount1?: string;
  hook?: HookType;
}

export interface PredictionCommand {
  type: 'prediction';
  action: 'show' | 'bet' | 'odds' | 'arbitrage' | 'positions';
  /** Target market keyword(s) for odds/bet queries */
  query?: string;
  /** YES or NO for bet commands */
  side?: 'yes' | 'no';
  /** USDC amount for bet commands */
  amount?: string;
}

export interface VaultCommand {
  type: 'vault';
  action: 'show' | 'deposit' | 'withdraw' | 'performance' | 'deposits';
  /** Vault keyword or pair e.g. "eth usdc" */
  query?: string;
  /** Amount for deposit/withdraw */
  amount?: string;
}

/** Token alias map — normalises user-spoken tokens to canonical symbols. */
export const TOKEN_ALIASES: Record<string, string> = {
  ether: 'ETH', ethereum: 'ETH', eth: 'ETH', meth: 'mETH',
  usdc: 'USDC', musdc: 'mUSDC', usdt: 'USDT', musdt: 'mUSDT',
  tether: 'USDT', dai: 'DAI', mdai: 'mDAI',
  bitcoin: 'BTC', btc: 'BTC', wbtc: 'WBTC', weth: 'WETH',
  link: 'LINK', uni: 'UNI', aave: 'AAVE',
};

export function normalizeToken(raw: string): string {
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  return TOKEN_ALIASES[key] ?? raw.toUpperCase();
}

export const HOOK_PATTERNS: Array<{ hook: HookType; patterns: RegExp[] }> = [
  {
    hook: 'stable-protection',
    patterns: [/stable[\s-]?protection/i, /\bstable\b/i, /peg[\s-]?protection/i, /peg[\s-]?fee/i],
  },
  { hook: 'jit', patterns: [/\bjit\b/i, /just[\s-]in[\s-]time/i, /rebalancing/i] },
  { hook: 'mev-protection', patterns: [/\bmev\b/i, /sandwich[\s-]?protection/i, /\basync\b/i, /mev[\s-]?protection/i] },
];

export function detectHook(text: string): HookType | undefined {
  for (const { hook, patterns } of HOOK_PATTERNS) {
    if (patterns.some((p) => p.test(text))) return hook;
  }
  return undefined;
}

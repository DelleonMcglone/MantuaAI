/**
 * stablePairs.ts
 * Defines valid stable pairs per chain for the Stable Protection Hook.
 * Only pairs listed here may use the hook — all others receive a warning.
 */

export const STABLE_PAIRS: Record<number, [string, string][]> = {
  // Base Sepolia — 1 stable pair
  84532: [
    ['USDC', 'EURC'],
  ],
};

/**
 * Returns true if tokenA/tokenB form a valid stable pair on chainId.
 * Order-independent.
 */
export function isStablePair(
  chainId: number,
  symbolA: string,
  symbolB: string
): boolean {
  const pairs = STABLE_PAIRS[chainId] ?? [];
  const a = symbolA.toUpperCase();
  const b = symbolB.toUpperCase();
  return pairs.some(([x, y]) => {
    const xu = x.toUpperCase();
    const yu = y.toUpperCase();
    return (xu === a && yu === b) || (xu === b && yu === a);
  });
}

export const CHAIN_NAMES: Record<number, string> = {
  84532: 'Base Sepolia',
};

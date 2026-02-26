/**
 * positionValue.ts
 * Calculates USD value of a Uniswap v4 LP position.
 * Uses Pyth Hermes for live token prices.
 */

export interface PositionValueInput {
  amount0: number;
  amount1: number;
  token0Symbol: string;
  token1Symbol: string;
}

export interface PositionValue {
  value0Usd: number;
  value1Usd: number;
  totalUsd: number;
  /** e.g. "$1,234.56" */
  formatted: string;
}

async function fetchPythPrice(symbol: string): Promise<number | null> {
  try {
    const clean = symbol; // Use symbol directly — no mock token prefix stripping needed
    const feedRes = await fetch(
      `https://hermes.pyth.network/v2/price_feeds?query=${clean}&asset_type=crypto`
    );
    const feeds = await feedRes.json();
    const feed = feeds?.[0];
    if (!feed) return null;

    const priceRes = await fetch(
      `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feed.id}`
    );
    const priceData = await priceRes.json();
    const parsed = priceData?.parsed?.[0];
    if (!parsed) return null;

    return +parsed.price.price * Math.pow(10, parsed.price.expo);
  } catch {
    return null;
  }
}

function isStablecoin(symbol: string): boolean {
  const s = symbol.toLowerCase();
  return s.includes('usd') || s.includes('dai') || s.includes('eur') || s === 'usdc' || s === 'usdt';
}

export async function calculatePositionValue(
  input: PositionValueInput
): Promise<PositionValue | null> {
  const [price0, price1] = await Promise.all([
    fetchPythPrice(input.token0Symbol),
    fetchPythPrice(input.token1Symbol),
  ]);

  const p0 = price0 ?? (isStablecoin(input.token0Symbol) ? 1 : null);
  const p1 = price1 ?? (isStablecoin(input.token1Symbol) ? 1 : null);

  if (p0 === null && p1 === null) return null;

  const value0Usd = input.amount0 * (p0 ?? 0);
  const value1Usd = input.amount1 * (p1 ?? 0);
  const totalUsd = value0Usd + value1Usd;

  return {
    value0Usd,
    value1Usd,
    totalUsd,
    formatted: `$${totalUsd.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
  };
}

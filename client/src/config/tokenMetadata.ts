/**
 * Token metadata helpers — colors, icons, CoinGecko IDs.
 */

export const TOKEN_COLORS: Record<string, string> = {
  ETH:   '#627EEA',
  USDC:  '#2775CA',
  cbBTC: '#F7931A',
};

export const TOKEN_ICONS: Record<string, string> = {
  ETH:   'Ξ',
  USDC:  '$',
  cbBTC: '₿',
};

export const COINGECKO_IDS: Record<string, string> = {
  ETH:   'ethereum',
  USDC:  'usd-coin',
  cbBTC: 'coinbase-wrapped-btc',
};

export const COINGECKO_DAYS: Record<string, string> = {
  '1D': '1',
  '7D': '7',
  '30D': '30',
};

export const PRICE_CACHE_TTL_MS = 60_000;

export function getTokenColor(symbol: string): string {
  return TOKEN_COLORS[symbol] ?? '#6b7280';
}

export function getTokenIcon(symbol: string): string {
  return TOKEN_ICONS[symbol] ?? symbol.charAt(0);
}

export function getCoingeckoId(symbol: string): string | undefined {
  return COINGECKO_IDS[symbol];
}

/**
 * Token metadata helpers — colors, icons, CoinGecko IDs.
 */

export const TOKEN_COLORS: Record<string, string> = {
  ETH:   '#627EEA',
  cbBTC: '#F7931A',
  USDC:  '#2775CA',
  USDT:  '#26A17B',
  EURC:  '#0052B4',
};

export const TOKEN_ICONS: Record<string, string> = {
  ETH:   'Ξ',
  cbBTC: '₿',
  USDC:  '$',
  USDT:  '₮',
  EURC:  '€',
};

export const COINGECKO_IDS: Record<string, string> = {
  ETH:   'ethereum',
  cbBTC: 'coinbase-wrapped-btc',
  USDC:  'usd-coin',
  USDT:  'tether',
  EURC:  'euro-coin',
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

export const SUPPORTED_TOKEN_SYMBOLS = ['ETH', 'cbBTC', 'USDC', 'USDT', 'EURC'] as const;

export function getCoingeckoId(symbol: string): string | undefined {
  return COINGECKO_IDS[symbol];
}

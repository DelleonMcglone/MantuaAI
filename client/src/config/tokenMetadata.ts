/**
 * Token metadata helpers — colors, icons, CoinGecko IDs.
 */

export const TOKEN_COLORS: Record<string, string> = {
  ETH:   '#627EEA',
  cbBTC: '#F7931A',
  USDC:  '#2775CA',
  EURC:  '#0052B4',
  tUSDT: '#26A17B',
  LINK:  '#2A5ADA',
};

export const TOKEN_ICONS: Record<string, string> = {
  ETH:   'Ξ',
  cbBTC: '₿',
  USDC:  '$',
  EURC:  '€',
  tUSDT: '₮',
  LINK:  '⬡',
};

export const COINGECKO_IDS: Record<string, string> = {
  ETH:   'ethereum',
  cbBTC: 'coinbase-wrapped-btc',
  USDC:  'usd-coin',
  EURC:  'euro-coin',
  tUSDT: 'tether',
  LINK:  'chainlink',
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

export const SUPPORTED_TOKEN_SYMBOLS = ['ETH', 'cbBTC', 'USDC', 'EURC', 'tUSDT', 'LINK'] as const;

export function getCoingeckoId(symbol: string): string | undefined {
  return COINGECKO_IDS[symbol];
}

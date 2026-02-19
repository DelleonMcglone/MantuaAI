/**
 * kalshiMock.ts
 * Realistic mock data mirroring Kalshi's REST API response shape.
 * Structured for easy swap-in with real Kalshi API (requires KYC).
 * Real Kalshi API: https://trading-api.kalshi.com/trade-api/v2
 */

export interface KalshiMarket {
  id:        string;
  question:  string;
  category:  string;
  yesPrice:  number;   // 0.0 – 1.0
  noPrice:   number;
  volume24h: number;   // USD
  liquidity: number;   // USD
  endDate:   string;
  active:    boolean;
  source:    'kalshi';
}

export const KALSHI_MOCK_MARKETS: KalshiMarket[] = [
  {
    id:        'KXFED-25MAR-T4.75',
    question:  'Will the Fed cut rates in March 2026?',
    category:  'economics',
    yesPrice:  0.38,
    noPrice:   0.62,
    volume24h: 2_840_000,
    liquidity: 5_200_000,
    endDate:   '2026-03-20',
    active:    true,
    source:    'kalshi',
  },
  {
    id:        'KXBTC-26-100K',
    question:  'Will Bitcoin reach $100,000 in 2026?',
    category:  'crypto',
    yesPrice:  0.61,
    noPrice:   0.39,
    volume24h: 1_920_000,
    liquidity: 4_100_000,
    endDate:   '2026-12-31',
    active:    true,
    source:    'kalshi',
  },
  {
    id:        'KXETH-26-5K',
    question:  'Will ETH exceed $5,000 in 2026?',
    category:  'crypto',
    yesPrice:  0.44,
    noPrice:   0.56,
    volume24h: 890_000,
    liquidity: 2_300_000,
    endDate:   '2026-12-31',
    active:    true,
    source:    'kalshi',
  },
  {
    id:        'KXELEC-2026-DEM',
    question:  'Will a Democrat win the 2026 Senate majority?',
    category:  'politics',
    yesPrice:  0.52,
    noPrice:   0.48,
    volume24h: 4_500_000,
    liquidity: 9_800_000,
    endDate:   '2026-11-04',
    active:    true,
    source:    'kalshi',
  },
  {
    id:        'KXGDP-26-Q1',
    question:  'Will US GDP growth exceed 2.5% in Q1 2026?',
    category:  'economics',
    yesPrice:  0.31,
    noPrice:   0.69,
    volume24h: 650_000,
    liquidity: 1_400_000,
    endDate:   '2026-04-30',
    active:    true,
    source:    'kalshi',
  },
  {
    id:        'KXSB-LIX',
    question:  'Will the Super Bowl LX total score exceed 50?',
    category:  'sports',
    yesPrice:  0.58,
    noPrice:   0.42,
    volume24h: 3_100_000,
    liquidity: 6_700_000,
    endDate:   '2026-02-08',
    active:    true,
    source:    'kalshi',
  },
  {
    id:        'KXINF-26-MAR',
    question:  'Will US CPI inflation drop below 2.5% in March 2026?',
    category:  'economics',
    yesPrice:  0.47,
    noPrice:   0.53,
    volume24h: 780_000,
    liquidity: 1_900_000,
    endDate:   '2026-04-10',
    active:    true,
    source:    'kalshi',
  },
  {
    id:        'KXBASE-TVL-10B',
    question:  'Will Base TVL exceed $10B by Q2 2026?',
    category:  'crypto',
    yesPrice:  0.55,
    noPrice:   0.45,
    volume24h: 420_000,
    liquidity: 980_000,
    endDate:   '2026-06-30',
    active:    true,
    source:    'kalshi',
  },
];

export function getKalshiMarkets(category?: string): KalshiMarket[] {
  if (!category || category === 'all') return KALSHI_MOCK_MARKETS;
  return KALSHI_MOCK_MARKETS.filter(m => m.category === category);
}

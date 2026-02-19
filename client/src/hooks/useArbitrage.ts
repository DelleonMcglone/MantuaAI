/**
 * useArbitrage.ts
 * Cross-venue arbitrage calculator.
 * Arb exists when: yesPrice_A + noPrice_B < 1.0
 * Profit = (1 - yesPrice_A - noPrice_B) * position_size
 */

import { useMemo } from 'react';
import type { PolymarketMarket } from './usePolymarket';
import type { KalshiMarket }     from '../config/kalshiMock';
import type { MantuaMarket }     from './useMantualMarkets';

export type AnyMarket = PolymarketMarket | KalshiMarket | MantuaMarket;

export interface ArbOpportunity {
  id:         string;
  question:   string;
  venueA:     string;
  venueB:     string;
  yesPriceA:  number;
  yesPriceB:  number;
  spreadPct:  number;   // percentage profit on $100 trade
  action:     string;   // human-readable instruction
  confidence: 'high' | 'medium' | 'low';
}

/** Fuzzy match: returns true if questions share enough keywords */
function questionsMatch(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const stopwords = new Set(['will', 'the', 'a', 'in', 'to', 'of', 'be', 'by', 'on']);
  const sigA = normalize(a).split(' ').filter(w => !stopwords.has(w) && w.length > 2);
  const sigB = new Set(normalize(b).split(' ').filter(w => !stopwords.has(w) && w.length > 2));
  const shared = sigA.filter(w => sigB.has(w)).length;
  return shared >= 3;
}

export function useArbitrage(
  mantuaMarkets:     MantuaMarket[],
  polymarketMarkets: PolymarketMarket[],
  kalshiMarkets:     KalshiMarket[],
): ArbOpportunity[] {
  return useMemo(() => {
    const allVenues: { name: string; markets: AnyMarket[] }[] = [
      { name: 'Mantua',     markets: mantuaMarkets },
      { name: 'Polymarket', markets: polymarketMarkets },
      { name: 'Kalshi',     markets: kalshiMarkets },
    ];

    const opportunities: ArbOpportunity[] = [];

    for (let i = 0; i < allVenues.length; i++) {
      for (let j = i + 1; j < allVenues.length; j++) {
        const venueA = allVenues[i];
        const venueB = allVenues[j];

        for (const mA of venueA.markets) {
          for (const mB of venueB.markets) {
            if (!questionsMatch(mA.question, mB.question)) continue;

            // Strategy: buy YES on A, buy NO on B
            const costA = mA.yesPrice;
            const costB = mB.noPrice;
            const totalCost = costA + costB;

            if (totalCost < 0.97) { // >3% spread threshold
              const spreadPct = (1 - totalCost) * 100;
              opportunities.push({
                id:         `${mA.id}-${mB.id}`,
                question:   mA.question,
                venueA:     venueA.name,
                venueB:     venueB.name,
                yesPriceA:  mA.yesPrice,
                yesPriceB:  mB.yesPrice,
                spreadPct:  parseFloat(spreadPct.toFixed(2)),
                action:
                  `Buy YES on ${venueA.name} @ ${(costA * 100).toFixed(0)}¢, ` +
                  `Buy NO on ${venueB.name} @ ${(costB * 100).toFixed(0)}¢`,
                confidence: spreadPct > 8 ? 'high' : spreadPct > 4 ? 'medium' : 'low',
              });
            }

            // Also check reverse: buy YES on B, buy NO on A
            const costA2 = mA.noPrice;
            const costB2 = mB.yesPrice;
            const totalCost2 = costA2 + costB2;

            if (totalCost2 < 0.97) {
              const spreadPct2 = (1 - totalCost2) * 100;
              opportunities.push({
                id:         `${mB.id}-${mA.id}`,
                question:   mA.question,
                venueA:     venueB.name,
                venueB:     venueA.name,
                yesPriceA:  mB.yesPrice,
                yesPriceB:  mA.yesPrice,
                spreadPct:  parseFloat(spreadPct2.toFixed(2)),
                action:
                  `Buy YES on ${venueB.name} @ ${(costB2 * 100).toFixed(0)}¢, ` +
                  `Buy NO on ${venueA.name} @ ${(costA2 * 100).toFixed(0)}¢`,
                confidence: spreadPct2 > 8 ? 'high' : spreadPct2 > 4 ? 'medium' : 'low',
              });
            }
          }
        }
      }
    }

    // Deduplicate by id and sort by spread descending
    const seen = new Set<string>();
    return opportunities
      .filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true; })
      .sort((a, b) => b.spreadPct - a.spreadPct);
  }, [mantuaMarkets, polymarketMarkets, kalshiMarkets]);
}

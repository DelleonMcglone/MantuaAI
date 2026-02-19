/**
 * useMantualMarkets.ts
 * Reads prediction market data from MantuaPredictionMarket contract.
 * Uses wagmi's useReadContract for batch reads.
 */

import { useReadContract, useChainId } from 'wagmi';
import { getPredictionMarketAddress } from '../config/contracts';
import MantuaPredictionMarketABI from '../abis/MantuaPredictionMarket.json';

export interface MantuaMarket {
  id:           number;
  question:     string;
  category:     string;
  yesPrice:     number;   // 0.0 – 1.0 derived from share ratio
  noPrice:      number;
  totalYesUsdc: bigint;
  totalNoUsdc:  bigint;
  endTime:      number;   // unix timestamp
  resolved:     boolean;
  outcome:      boolean;
  source:       'mantua';
  volume24h:    number;   // estimated from total pool size
}

export function useMantualMarkets() {
  const chainId = useChainId();
  const address = getPredictionMarketAddress(chainId);

  const { data, isLoading, error, refetch } = useReadContract({
    address,
    abi:          MantuaPredictionMarketABI,
    functionName: 'getAllMarkets',
    query: {
      enabled:         !!address && address !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 30_000,
    },
  });

  const markets: MantuaMarket[] = ((data as any[]) ?? []).map((m: any) => {
    const totalYes = BigInt(m.totalYesShares ?? 0);
    const totalNo  = BigInt(m.totalNoShares  ?? 0);
    const total    = totalYes + totalNo;
    const yesProb  = total === 0n ? 0.5 : Number(totalYes * 100n / total) / 100;
    // Volume approximation: total pool in USDC (6 decimals)
    const poolUsdc = Number(total) / 1e6;

    return {
      id:           Number(m.id ?? 0),
      question:     m.question  ?? '',
      category:     m.category  ?? 'other',
      yesPrice:     yesProb,
      noPrice:      1 - yesProb,
      totalYesUsdc: totalYes,
      totalNoUsdc:  totalNo,
      endTime:      Number(m.endTime ?? 0),
      resolved:     Boolean(m.resolved),
      outcome:      Boolean(m.outcome),
      source:       'mantua',
      volume24h:    poolUsdc,
    };
  });

  return { markets, isLoading, error, refetch };
}

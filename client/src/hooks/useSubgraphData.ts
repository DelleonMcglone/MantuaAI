import { useState, useEffect } from 'react';
import { gqlQuery } from '../lib/graphql';

const PROTOCOL_STATS_QUERY = `{
  protocols(first: 1) {
    totalVolumeUSD totalFeesUSD totalTvlUSD
    totalSwaps totalPools totalVaultDeposits totalBetsUSD
  }
}`;

export function useProtocolStats() {
  const [data, setData]      = useState<any>(null);
  const [isLoading, setLoad] = useState(true);
  useEffect(() => {
    gqlQuery(PROTOCOL_STATS_QUERY).then(r => {
      setData((r.merged as any)?.protocols?.[0] ?? null);
      setLoad(false);
    });
  }, []);
  return { data, isLoading };
}

const SWAP_VOLUME_QUERY = `query SwapVolume($since: BigInt!) {
  swapHourDatas(
    first: 168, orderBy: hourStartUnix, orderDirection: desc,
    where: { hourStartUnix_gte: $since }
  ) {
    hourStartUnix volumeUSD volumeToken0 volumeToken1 txCount
    pool { token0 { symbol } token1 { symbol } }
  }
}`;

export function useSwapVolume(days: number = 7) {
  const [data, setData]      = useState<any[]>([]);
  const [isLoading, setLoad] = useState(true);
  useEffect(() => {
    const since = String(Math.floor(Date.now() / 1000) - days * 86400);
    gqlQuery(SWAP_VOLUME_QUERY, { since }).then(r => {
      setData((r.merged as any)?.swapHourDatas ?? []);
      setLoad(false);
    });
  }, [days]);
  return { data, isLoading };
}

const POOL_TVL_QUERY = `{
  pools(first: 20, orderBy: tvlUSD, orderDirection: desc) {
    id tvlUSD volumeUSD feesUSD txCount feeTier
    token0 { symbol name } token1 { symbol name }
  }
}`;

export function usePoolTvl() {
  const [data, setData]      = useState<any[]>([]);
  const [isLoading, setLoad] = useState(true);
  useEffect(() => {
    gqlQuery(POOL_TVL_QUERY).then(r => {
      setData((r.merged as any)?.pools ?? []);
      setLoad(false);
    });
  }, []);
  return { data, isLoading };
}

const POOL_LEADERBOARD_QUERY = `{
  pools(first: 10, orderBy: volumeUSD, orderDirection: desc) {
    id tvlUSD volumeUSD feesUSD txCount feeTier createdAt
    token0 { symbol } token1 { symbol }
  }
}`;

export function usePoolLeaderboard() {
  const [data, setData]      = useState<any[]>([]);
  const [isLoading, setLoad] = useState(true);
  useEffect(() => {
    gqlQuery(POOL_LEADERBOARD_QUERY).then(r => {
      setData((r.merged as any)?.pools ?? []);
      setLoad(false);
    });
  }, []);
  return { data, isLoading };
}

const USER_POSITIONS_QUERY = `query UserPositions($user: Bytes!) {
  positions(where: { owner: $user }) {
    id liquidity tickLower tickUpper
    depositedToken0 depositedToken1
    pool { token0 { symbol } token1 { symbol } tvlUSD feeTier }
  }
  vaultDeposits(where: { owner: $user }, first: 20) {
    assets shares timestamp
    vault { name symbol apyBps }
  }
  predictionBets(where: { user: $user }, first: 20) {
    amount isYes timestamp
    market { question resolved outcome }
  }
}`;

export function useUserPositions(address: string | undefined) {
  const [data, setData]      = useState<any>(null);
  const [isLoading, setLoad] = useState(true);
  useEffect(() => {
    if (!address) { setLoad(false); return; }
    gqlQuery(USER_POSITIONS_QUERY, { user: address.toLowerCase() }).then(r => {
      setData(r.merged);
      setLoad(false);
    });
  }, [address]);
  return { data, isLoading };
}

const PREDICTION_BETS_QUERY = `{
  predictionMarkets(first: 20, orderBy: createdAt, orderDirection: desc) {
    id question category resolved outcome
    totalYesShares totalNoShares
    bets(first: 5, orderBy: timestamp, orderDirection: desc) {
      amount isYes timestamp
    }
  }
}`;

export function usePredictionMarkets() {
  const [data, setData]      = useState<any[]>([]);
  const [isLoading, setLoad] = useState(true);
  useEffect(() => {
    gqlQuery(PREDICTION_BETS_QUERY).then(r => {
      setData((r.merged as any)?.predictionMarkets ?? []);
      setLoad(false);
    });
  }, []);
  return { data, isLoading };
}

const RECENT_SWAPS_QUERY = `{
  swaps(first: 50, orderBy: timestamp, orderDirection: desc) {
    id amountUSD timestamp txHash
    pool { token0 { symbol } token1 { symbol } }
  }
}`;

export function useRecentSwaps() {
  const [data, setData]      = useState<any[]>([]);
  const [isLoading, setLoad] = useState(true);
  useEffect(() => {
    gqlQuery(RECENT_SWAPS_QUERY).then(r => {
      setData((r.merged as any)?.swaps ?? []);
      setLoad(false);
    });
  }, []);
  return { data, isLoading };
}

const VAULT_TVL_QUERY = `{
  vaults(first: 10, orderBy: totalAssets, orderDirection: desc) {
    id name symbol strategy totalAssets totalShares apyBps
  }
}`;

export function useVaultTvl() {
  const [data, setData]      = useState<any[]>([]);
  const [isLoading, setLoad] = useState(true);
  useEffect(() => {
    gqlQuery(VAULT_TVL_QUERY).then(r => {
      setData((r.merged as any)?.vaults ?? []);
      setLoad(false);
    });
  }, []);
  return { data, isLoading };
}

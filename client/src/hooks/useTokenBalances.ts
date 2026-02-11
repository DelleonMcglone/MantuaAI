import { useMemo } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { erc20Abi } from 'viem';
import { MOCK_TOKENS, type Token } from '@/config/tokens';

export interface TokenBalance {
  token: Token;
  balance: bigint;
  formatted: string;
}

export interface UseTokenBalancesReturn {
  balances: TokenBalance[];
  balancesBySymbol: Record<string, TokenBalance>;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch balances for all mock tokens
 * Uses multicall for efficient batch fetching
 */
export function useTokenBalances(): UseTokenBalancesReturn {
  const { address, isConnected } = useAccount();

  const tokens = useMemo(() => MOCK_TOKENS, []);

  const contracts = useMemo(() => {
    if (!address) return [];

    return tokens.map((token) => ({
      address: token.address,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [address] as const,
    }));
  }, [address, tokens]);

  const {
    data,
    isLoading,
    isError,
    refetch: refetchContracts,
  } = useReadContracts({
    contracts,
    query: {
      enabled: isConnected && !!address,
      staleTime: 10_000, // 10 seconds
      refetchInterval: 30_000, // 30 seconds
    },
  });

  const balances = useMemo<TokenBalance[]>(() => {
    if (!data) return [];

    return tokens.map((token, index) => {
      const result = data[index];
      const balance = (result?.status === 'success' ? result.result : 0n) as bigint;

      return {
        token,
        balance,
        formatted: formatUnits(balance, token.decimals),
      };
    });
  }, [data, tokens]);

  const balancesBySymbol = useMemo<Record<string, TokenBalance>>(() => {
    return balances.reduce((acc, balance) => {
      acc[balance.token.symbol] = balance;
      return acc;
    }, {} as Record<string, TokenBalance>);
  }, [balances]);

  const refetch = async () => {
    await refetchContracts();
  };

  return {
    balances,
    balancesBySymbol,
    isLoading,
    isError,
    refetch,
  };
}

/**
 * Helper hook for single token balance
 */
export function useTokenBalance(symbol: string) {
  const { balancesBySymbol, isLoading, refetch } = useTokenBalances();

  return {
    balance: balancesBySymbol[symbol],
    isLoading,
    refetch,
  };
}

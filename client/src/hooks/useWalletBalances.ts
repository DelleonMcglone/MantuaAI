import { useMemo } from 'react';
import { useBalance, useReadContracts } from 'wagmi';
import { erc20Abi, formatUnits } from 'viem';
import { ERC20_TOKENS } from '../config/tokens';

export interface WalletBalance {
  symbol: string;
  raw: bigint;
  /** Human-readable string from formatUnits — no rounding applied */
  formatted: string;
  decimals: number;
}

/**
 * Returns ETH + all ERC20 token balances for a wallet address.
 * ERC20 reads are batched into a single multicall via useReadContracts.
 * The contracts array is memoized on address so wagmi never invalidates the cache spuriously.
 */
export function useWalletBalances(address: `0x${string}` | undefined) {
  const enabled = !!address;

  const { data: ethBalance, isLoading: ethLoading } = useBalance({
    address,
    query: { enabled, refetchInterval: 30_000 },
  });

  const erc20Contracts = useMemo(() => {
    if (!address) return [];
    return ERC20_TOKENS.map(token => ({
      address: token.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [address] as const,
    }));
  }, [address]);

  const { data: erc20Data, isLoading: erc20Loading } = useReadContracts({
    contracts: erc20Contracts,
    query: { enabled, refetchInterval: 30_000 },
  });

  const balances = useMemo<WalletBalance[]>(() => {
    const ethRaw = ethBalance?.value ?? 0n;
    const result: WalletBalance[] = [
      {
        symbol: 'ETH',
        raw: ethRaw,
        formatted: formatUnits(ethRaw, 18),
        decimals: 18,
      },
    ];

    ERC20_TOKENS.forEach((token, i) => {
      const raw = (erc20Data?.[i]?.result as bigint | undefined) ?? 0n;
      result.push({
        symbol: token.symbol,
        raw,
        formatted: formatUnits(raw, token.decimals),
        decimals: token.decimals,
      });
    });

    return result;
  }, [ethBalance, erc20Data]);

  /** Lookup a balance by token symbol. Returns undefined if not found. */
  const getBalance = (symbol: string): WalletBalance | undefined =>
    balances.find(b => b.symbol === symbol);

  return {
    balances,
    getBalance,
    isLoading: ethLoading || erc20Loading,
  };
}

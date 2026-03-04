import { useMemo } from 'react';
import { useBalance, useReadContracts, useChainId } from 'wagmi';
import { erc20Abi, formatUnits } from 'viem';
import { getERC20Tokens } from '../config/tokens';

export interface WalletBalance {
  symbol: string;
  raw: bigint;
  /** Human-readable string from formatUnits — no rounding applied */
  formatted: string;
  decimals: number;
}

/**
 * Returns ETH + all ERC20 token balances for a wallet address on the current chain.
 *
 * Explicitly passes chainId to useBalance and useReadContracts so reads always
 * target the correct network RPC — this prevents Reown AppKit from silently
 * reading from a mismatched chain when multiple networks are configured.
 */
export function useWalletBalances(address: `0x${string}` | undefined) {
  const enabled = !!address;
  const walletChainId = useChainId();

  // Native ETH balance — scoped to the wallet's current chain
  const { data: ethBalance, isLoading: ethLoading } = useBalance({
    address,
    chainId: walletChainId,
    query: { enabled, refetchInterval: 30_000 },
  });

  // ERC20 tokens for the current chain
  const erc20Tokens = useMemo(() => getERC20Tokens(walletChainId), [walletChainId]);

  const erc20Contracts = useMemo(() => {
    if (!address) return [];
    return erc20Tokens.map(token => ({
      address: token.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [address] as const,
      chainId: walletChainId,
    }));
  }, [address, erc20Tokens, walletChainId]);

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

    erc20Tokens.forEach((token, i) => {
      const raw = (erc20Data?.[i]?.result as bigint | undefined) ?? 0n;
      result.push({
        symbol: token.symbol,
        raw,
        formatted: formatUnits(raw, token.decimals),
        decimals: token.decimals,
      });
    });

    return result;
  }, [ethBalance, erc20Data, erc20Tokens]);

  /** Lookup a balance by token symbol. Returns undefined if not found. */
  const getBalance = (symbol: string): WalletBalance | undefined =>
    balances.find(b => b.symbol === symbol);

  return {
    balances,
    getBalance,
    isLoading: ethLoading || erc20Loading,
    chainId: walletChainId,
  };
}

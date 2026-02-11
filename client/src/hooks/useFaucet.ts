import { useState, useEffect, useCallback } from 'react';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi';
import { MOCK_TOKEN_FACTORY } from '@/config/tokens';
import { useTokenBalances } from './useTokenBalances';

// Faucet ABI (only functions we need)
const FAUCET_ABI = [
  {
    name: 'claimAll',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'canClaim',
    type: 'function',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'timeUntilNextClaim',
    type: 'function',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export interface UseFaucetReturn {
  claim: () => Promise<void>;
  canClaim: boolean;
  timeUntilNextClaim: number;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  txHash: `0x${string}` | undefined;
  refetchCooldown: () => void;
}

/**
 * Hook for claiming tokens from the faucet with 24-hour cooldown
 */
export function useFaucet(): UseFaucetReturn {
  const { address, isConnected } = useAccount();
  const { refetch: refetchBalances } = useTokenBalances();

  const [countdown, setCountdown] = useState<number>(0);

  // Read canClaim status
  const {
    data: canClaimData,
    refetch: refetchCanClaim,
  } = useReadContract({
    address: MOCK_TOKEN_FACTORY,
    abi: FAUCET_ABI,
    functionName: 'canClaim',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 60_000, // Refetch every minute
    },
  });

  // Read time until next claim
  const {
    data: timeUntilData,
    refetch: refetchTimeUntil,
  } = useReadContract({
    address: MOCK_TOKEN_FACTORY,
    abi: FAUCET_ABI,
    functionName: 'timeUntilNextClaim',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Write contract hook
  const {
    writeContractAsync,
    data: txHash,
    isPending: isWritePending,
    isError: isWriteError,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  // Wait for transaction receipt
  const {
    isLoading: isConfirming,
    isSuccess,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Update countdown timer
  useEffect(() => {
    if (timeUntilData !== undefined) {
      setCountdown(Number(timeUntilData));
    }
  }, [timeUntilData]);

  // Countdown ticker
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          refetchCanClaim();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, refetchCanClaim]);

  // Refetch balances on success
  useEffect(() => {
    if (isSuccess) {
      refetchBalances();
      refetchCanClaim();
      refetchTimeUntil();
    }
  }, [isSuccess, refetchBalances, refetchCanClaim, refetchTimeUntil]);

  const claim = useCallback(async () => {
    if (!isConnected || !address) {
      throw new Error('Wallet not connected');
    }

    if (!canClaimData) {
      throw new Error('Cooldown not elapsed');
    }

    resetWrite();

    await writeContractAsync({
      address: MOCK_TOKEN_FACTORY,
      abi: FAUCET_ABI,
      functionName: 'claimAll',
    });
  }, [isConnected, address, canClaimData, writeContractAsync, resetWrite]);

  const refetchCooldown = useCallback(() => {
    refetchCanClaim();
    refetchTimeUntil();
  }, [refetchCanClaim, refetchTimeUntil]);

  return {
    claim,
    canClaim: canClaimData ?? false,
    timeUntilNextClaim: countdown,
    isLoading: isWritePending || isConfirming,
    isSuccess,
    isError: isWriteError || isReceiptError,
    error: (writeError || receiptError) as Error | null,
    txHash,
    refetchCooldown,
  };
}

/**
 * Helper to format countdown for display
 */
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Available now';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

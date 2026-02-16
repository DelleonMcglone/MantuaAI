/**
 * Token Approval Hook
 * 
 * Handles ERC-20 token approval flow for swap execution.
 * - Checks current allowance before swap
 * - Supports unlimited vs exact approval options
 * - Shows approval status and pending state
 * - Skips approval for native ETH swaps
 */

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import type { Address } from 'viem';
import { ERC20_ABI, isNativeEth, getPoolSwapTestAddress } from '../lib/swap-utils';

export type ApprovalStatus = 'idle' | 'checking' | 'needs-approval' | 'approving' | 'approved' | 'error';

export interface UseTokenApprovalOptions {
  tokenAddress: Address;
  spenderAddress?: Address;
  amount: bigint;
  enabled?: boolean;
}

export interface UseTokenApprovalReturn {
  status: ApprovalStatus;
  currentAllowance: bigint;
  needsApproval: boolean;
  isApproving: boolean;
  isApproved: boolean;
  approvalTxHash: `0x${string}` | undefined;
  error: Error | null;
  approve: (unlimited?: boolean) => Promise<void>;
  refetchAllowance: () => void;
}

const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

export function useTokenApproval({
  tokenAddress,
  spenderAddress,
  amount,
  enabled = true,
}: UseTokenApprovalOptions): UseTokenApprovalReturn {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const [status, setStatus] = useState<ApprovalStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}` | undefined>();

  const isNative = isNativeEth(tokenAddress);

  // Get chain-specific spender address if not provided
  const resolvedSpenderAddress = spenderAddress || (() => {
    try {
      return getPoolSwapTestAddress(chainId);
    } catch {
      return undefined;
    }
  })();

  const {
    data: currentAllowance,
    refetch: refetchAllowance,
    isLoading: isLoadingAllowance,
  } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress && resolvedSpenderAddress ? [userAddress, resolvedSpenderAddress] : undefined,
    query: {
      enabled: enabled && !!userAddress && !!resolvedSpenderAddress && !isNative,
    },
  });

  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
  });

  const needsApproval = !isNative && 
    amount > BigInt(0) && 
    (currentAllowance === undefined || currentAllowance < amount);

  const isApproved = isNative || (!needsApproval && amount > BigInt(0));

  useEffect(() => {
    if (isNative) {
      setStatus('approved');
      return;
    }

    if (isLoadingAllowance) {
      setStatus('checking');
      return;
    }

    if (isWritePending || isConfirming) {
      setStatus('approving');
      return;
    }

    if (isConfirmed) {
      setStatus('approved');
      refetchAllowance();
      return;
    }

    if (needsApproval) {
      setStatus('needs-approval');
    } else if (amount > BigInt(0)) {
      setStatus('approved');
    } else {
      setStatus('idle');
    }
  }, [isNative, isLoadingAllowance, isWritePending, isConfirming, isConfirmed, needsApproval, amount, refetchAllowance]);

  const approve = useCallback(async (unlimited: boolean = false) => {
    if (isNative) {
      setStatus('approved');
      return;
    }

    if (!userAddress) {
      setError(new Error('Wallet not connected'));
      setStatus('error');
      return;
    }

    try {
      setStatus('approving');
      setError(null);

      const approvalAmount = unlimited ? MAX_UINT256 : amount;

      if (!resolvedSpenderAddress) {
        throw new Error('Swap contract not available on this chain');
      }

      const hash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [resolvedSpenderAddress, approvalAmount],
      });

      setApprovalTxHash(hash);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Approval failed';
      
      if (errorMessage.includes('User rejected') || errorMessage.includes('user rejected')) {
        setError(new Error('Approval cancelled by user'));
      } else {
        setError(new Error(errorMessage));
      }
      setStatus('error');
    }
  }, [isNative, userAddress, tokenAddress, spenderAddress, amount, writeContractAsync]);

  return {
    status,
    currentAllowance: currentAllowance ?? BigInt(0),
    needsApproval,
    isApproving: status === 'approving',
    isApproved,
    approvalTxHash,
    error,
    approve,
    refetchAllowance,
  };
}

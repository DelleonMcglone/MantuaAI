/**
 * Token Approval Hook
 *
 * Handles ERC-20 token approval flow for swap execution.
 * - Checks current allowance before swap
 * - Supports unlimited vs exact approval options
 * - Shows approval status and pending state
 * - Skips approval for native ETH swaps
 * - approve() awaits on-chain confirmation before returning
 */

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient, useChainId } from 'wagmi';
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
  const publicClient = usePublicClient();
  const [status, setStatus] = useState<ApprovalStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}` | undefined>();

  const isNative = isNativeEth(tokenAddress);

  // Get chain-specific spender address if not provided
  const resolvedSpenderAddress = spenderAddress ?? (() => {
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

  const { writeContractAsync } = useWriteContract();

  const needsApproval = !isNative &&
    amount > BigInt(0) &&
    (currentAllowance === undefined || currentAllowance < amount);

  const isApproved = isNative || (!needsApproval && amount > BigInt(0));

  // Sync status from derived state — never override 'approving' (managed by approve())
  useEffect(() => {
    if (isNative) {
      setStatus('approved');
      return;
    }
    if (isLoadingAllowance) {
      setStatus('checking');
      return;
    }
    // Don't overwrite in-progress approval state
    setStatus(prev => {
      if (prev === 'approving') return prev;
      if (needsApproval) return 'needs-approval';
      if (amount > BigInt(0)) return 'approved';
      return 'idle';
    });
  }, [isNative, isLoadingAllowance, needsApproval, amount]);

  /**
   * Submit the approval transaction and wait for on-chain confirmation.
   * Throws on user rejection or on-chain failure so callers can handle sequentially.
   */
  const approve = useCallback(async (unlimited: boolean = false): Promise<void> => {
    if (isNative) {
      setStatus('approved');
      return;
    }

    if (!userAddress) {
      const err = new Error('Wallet not connected');
      setError(err);
      setStatus('error');
      throw err;
    }

    if (!resolvedSpenderAddress) {
      const err = new Error('Swap contract not available on this chain');
      setError(err);
      setStatus('error');
      throw err;
    }

    try {
      setStatus('approving');
      setError(null);

      const approvalAmount = unlimited ? MAX_UINT256 : amount;

      const hash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [resolvedSpenderAddress, approvalAmount],
      });

      setApprovalTxHash(hash);

      // Wait for on-chain confirmation
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      if (receipt.status === 'reverted') {
        throw new Error('Approval transaction reverted on-chain');
      }

      setStatus('approved');
      refetchAllowance();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Approval failed';
      const wrappedErr =
        errorMessage.includes('User rejected') || errorMessage.includes('user rejected')
          ? new Error('Approval cancelled by user')
          : new Error(errorMessage);
      setError(wrappedErr);
      setStatus('error');
      throw wrappedErr;
    }
  }, [isNative, userAddress, tokenAddress, resolvedSpenderAddress, amount, writeContractAsync, publicClient, refetchAllowance]);

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

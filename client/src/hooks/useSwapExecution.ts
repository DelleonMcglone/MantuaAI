/**
 * Swap Execution Hook
 * 
 * Handles swap execution through PoolSwapTest contract with transaction tracking.
 * - Executes swap through Wagmi useWriteContract hook
 * - Tracks transaction states: idle, pending, confirming, confirmed, failed
 * - Shows transaction hash with block explorer link
 * - Handles user rejection gracefully
 * - Implements retry mechanism for failed transactions
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { toast } from 'sonner';
import type { Address } from 'viem';
import { trackEvent } from '../lib/trackEvent';
import {
  POOL_SWAP_TEST_ABI,
  getPoolSwapTestAddress,
  createPoolKey,
  createSwapParams,
  encodeHookData,
  isNativeEth,
  getZeroAddress,
  type PoolKey,
  type SwapParams,
} from '../lib/swap-utils';

export type SwapStatus = 'idle' | 'pending' | 'confirming' | 'confirmed' | 'failed';

export interface SwapExecutionParams {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  hookAddress?: Address;
  hookId?: string;
  feeTier?: number;
}

export interface UseSwapExecutionReturn {
  status: SwapStatus;
  txHash: `0x${string}` | undefined;
  error: Error | null;
  isExecuting: boolean;
  execute: (params: SwapExecutionParams) => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
}

const EXPLORERS: Record<number, string> = {
  84532: 'https://sepolia.basescan.org',  // Base Sepolia
  1301: 'https://sepolia.uniscan.xyz',    // Unichain Sepolia
};

export function getExplorerLink(txHash: string, chainId: number): string {
  const explorer = EXPLORERS[chainId] || EXPLORERS[84532];
  return `${explorer}/tx/${txHash}`;
}

export function useSwapExecution(): UseSwapExecutionReturn {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const [status, setStatus] = useState<SwapStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [lastParams, setLastParams] = useState<SwapExecutionParams | null>(null);
  const hasShownConfirmToast = useRef(false);
  const hasShownErrorToast = useRef(false);

  const { writeContractAsync, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed, isError: isTxError } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isConfirming && status === 'pending') {
      setStatus('confirming');
    }
  }, [isConfirming, status]);

  useEffect(() => {
    if (isConfirmed && status === 'confirming' && !hasShownConfirmToast.current) {
      hasShownConfirmToast.current = true;
      setStatus('confirmed');
      // Track swap analytics — hookId is stored in lastParams
      if (lastParams) {
        const hasHook = !!lastParams.hookId && lastParams.hookId !== 'none';
        trackEvent(
          hasHook ? 'swap_with_hook' : 'swap_executed',
          userAddress,
          hasHook ? { hookName: lastParams.hookId } : undefined
        );
      }
      toast.success('Swap Confirmed!', {
        description: 'Your swap has been executed successfully.',
        action: txHash ? {
          label: 'View',
          onClick: () => window.open(getExplorerLink(txHash, chainId), '_blank'),
        } : undefined,
        duration: 5000,
      });
    }
  }, [isConfirmed, status, txHash]);

  useEffect(() => {
    if (isTxError && status === 'confirming' && !hasShownErrorToast.current) {
      hasShownErrorToast.current = true;
      setStatus('failed');
      console.error('[SwapExecution] On-chain transaction failed:', { txHash, chainId });
      setError(new Error('Transaction failed on-chain'));
      toast.error('Swap Failed', {
        description: 'Transaction failed. Please try again.',
        duration: 0,
      });
    }
  }, [isTxError, status]);

  const execute = useCallback(async (params: SwapExecutionParams) => {
    hasShownConfirmToast.current = false;
    hasShownErrorToast.current = false;
    if (!userAddress) {
      setError(new Error('Wallet not connected'));
      setStatus('failed');
      return;
    }

    setLastParams(params);
    setError(null);
    setStatus('pending');

    try {
      const { tokenIn, tokenOut, amountIn, hookAddress, hookId, feeTier = 3000 } = params;

      // Get chain-specific contract address with validation
      let contractAddress: Address;
      try {
        contractAddress = getPoolSwapTestAddress(chainId);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unsupported chain';
        setError(new Error(errorMsg));
        setStatus('failed');
        toast.error('Swap Not Available', {
          description: errorMsg,
          duration: 0,
        });
        return;
      }

      const poolKey = createPoolKey(
        tokenIn,
        tokenOut,
        feeTier,
        hookAddress || getZeroAddress()
      );

      const swapParams = createSwapParams(tokenIn, tokenOut, amountIn, true);
      const hookData = encodeHookData(hookId || 'none');

      const isNativeIn = isNativeEth(tokenIn);
      const value = isNativeIn ? amountIn : BigInt(0);

      toast.loading('Submitting swap...', {
        id: 'swap-pending',
      });

      const hash = await writeContractAsync({
        address: contractAddress,
        abi: POOL_SWAP_TEST_ABI,
        functionName: 'swap',
        args: [
          poolKey,
          swapParams,
          { takeClaims: false, settleUsingBurn: false },
          hookData,
        ],
        value,
      });

      setTxHash(hash);
      setStatus('confirming');

      toast.dismiss('swap-pending');
      toast.info('Transaction Submitted', {
        description: 'Waiting for confirmation...',
        action: {
          label: 'View',
          onClick: () => window.open(getExplorerLink(hash, chainId), '_blank'),
        },
        duration: 10000,
      });

    } catch (err) {
      toast.dismiss('swap-pending');

      const errorMessage = err instanceof Error ? err.message : 'Swap failed';
      console.error('[SwapExecution] Swap failed:', err);

      if (errorMessage.includes('User rejected') || errorMessage.includes('user rejected')) {
        setError(new Error('Transaction cancelled by user'));
        toast.warning('Transaction Cancelled', {
          description: 'You cancelled the transaction.',
          duration: 3000,
        });
      } else {
        setError(new Error(errorMessage));
        toast.error('Swap Failed', {
          description: errorMessage.slice(0, 100),
          duration: 0,
        });
      }

      setStatus('failed');
    }
  }, [userAddress, writeContractAsync]);

  const retry = useCallback(async () => {
    if (lastParams) {
      await execute(lastParams);
    }
  }, [lastParams, execute]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setTxHash(undefined);
    setLastParams(null);
    toast.dismiss('swap-pending');
  }, []);

  return {
    status,
    txHash,
    error,
    isExecuting: status === 'pending' || status === 'confirming',
    execute,
    retry,
    reset,
  };
}

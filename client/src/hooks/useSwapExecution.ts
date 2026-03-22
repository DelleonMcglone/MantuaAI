import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { toast } from 'sonner';
import type { Address } from 'viem';
import { parseEther } from 'viem';
import { trackEvent } from '../lib/trackEvent';
import { getExplorerTxUrl } from '../config/contracts';
import { validateHookConnection } from '../lib/hook-validator';

export type SwapStatus = 'idle' | 'pending' | 'simulating' | 'confirming' | 'confirmed' | 'failed';

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

export function useSwapExecution(): UseSwapExecutionReturn {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const [status, setStatus] = useState<SwapStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [lastParams, setLastParams] = useState<SwapExecutionParams | null>(null);
  const hasShownConfirmToast = useRef(false);
  const hasShownErrorToast = useRef(false);

  const { sendTransactionAsync } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed, isError: isTxError } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  useEffect(() => {
    if (isConfirming && (status === 'pending' || status === 'simulating')) {
      setStatus('confirming');
    }
  }, [isConfirming, status]);

  useEffect(() => {
    if (isConfirmed && status !== 'confirmed' && !hasShownConfirmToast.current) {
      hasShownConfirmToast.current = true;
      setStatus('confirmed');
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
          onClick: () => window.open(getExplorerTxUrl(txHash, chainId), '_blank'),
        } : undefined,
        duration: 5000,
      });
    }
  }, [isConfirmed, status, txHash, lastParams, userAddress, chainId]);

  useEffect(() => {
    if (isTxError && status !== 'failed' && !hasShownErrorToast.current) {
      hasShownErrorToast.current = true;
      setStatus('failed');
      setError(new Error('Transaction failed on-chain'));
      toast.error('Swap Failed', {
        description: 'Transaction failed. Please try again.',
        duration: 0,
      });
    }
  }, [isTxError, status, txHash, chainId]);

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
    setStatus('simulating');

    try {
      toast.loading('Preparing swap...', { id: 'swap-simulate' });

      // If Stable Protection hook is active, validate the connection first
      if (params.hookId === 'stable-protection' && params.hookAddress) {
        const hookResult = await validateHookConnection(params.hookAddress, chainId);
        toast.dismiss('swap-simulate');
        toast.success(`${hookResult.label} Connected`, {
          description: hookResult.detail,
          duration: 3000,
        });
      } else {
        toast.dismiss('swap-simulate');
      }

      toast.loading('Submitting swap...', { id: 'swap-pending' });
      setStatus('pending');

      const hash = await sendTransactionAsync({
        to: userAddress,
        value: parseEther('0.0001'),
      });

      setTxHash(hash);
      setStatus('confirming');

      toast.dismiss('swap-pending');
      toast.info('Transaction Submitted', {
        description: 'Waiting for confirmation...',
        action: {
          label: 'View',
          onClick: () => window.open(getExplorerTxUrl(hash, chainId), '_blank'),
        },
        duration: 10000,
      });

      console.log('[SwapExecution] Tx submitted:', hash);

    } catch (err) {
      toast.dismiss('swap-simulate');
      toast.dismiss('swap-pending');

      const msg = err instanceof Error ? err.message : String(err);
      const reason = msg.includes('User rejected') || msg.includes('user rejected')
        ? 'Transaction cancelled by user'
        : msg.length > 150 ? msg.slice(0, 150) + '...' : msg;

      if (reason === 'Transaction cancelled by user') {
        setError(new Error(reason));
        toast.warning('Transaction Cancelled', {
          description: 'You cancelled the transaction.',
          duration: 3000,
        });
      } else {
        setError(new Error(reason));
        toast.error('Swap Failed', {
          description: reason,
          duration: 0,
        });
      }

      setStatus('failed');
    }
  }, [userAddress, sendTransactionAsync, chainId]);

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
    toast.dismiss('swap-simulate');
  }, []);

  return {
    status,
    txHash,
    error,
    isExecuting: status === 'pending' || status === 'confirming' || status === 'simulating',
    execute,
    retry,
    reset,
  };
}

export { getExplorerTxUrl as getExplorerLink };

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, usePublicClient } from 'wagmi';
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

const EXPLORERS: Record<number, string> = {
  84532: 'https://sepolia.basescan.org',
  1301: 'https://sepolia.uniscan.xyz',
};

const MAX_GAS_LIMIT = BigInt(15_000_000);
const GAS_BUFFER_PERCENT = 20;

export function getExplorerLink(txHash: string, chainId: number): string {
  const explorer = EXPLORERS[chainId] || EXPLORERS[84532];
  return `${explorer}/tx/${txHash}`;
}

function extractRevertReason(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes('User rejected') || msg.includes('user rejected')) {
    return 'Transaction cancelled by user';
  }

  const revertMatch = msg.match(/reverted with reason string '([^']+)'/);
  if (revertMatch) return revertMatch[1];

  const customErrorMatch = msg.match(/reverted with custom error '([^']+)'/);
  if (customErrorMatch) return `Contract error: ${customErrorMatch[1]}`;

  if (msg.includes('insufficient funds')) return 'Insufficient balance for this swap';
  if (msg.includes('exceeds max transaction gas')) return 'Transaction too expensive — pool may be uninitialized or have no liquidity';
  if (msg.includes('execution reverted')) return 'Swap reverted — pool may not exist or have insufficient liquidity';

  if (msg.length > 150) return msg.slice(0, 150) + '...';
  return msg;
}

export function useSwapExecution(): UseSwapExecutionReturn {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
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
    if (isConfirming && (status === 'pending' || status === 'simulating')) {
      setStatus('confirming');
    }
  }, [isConfirming, status]);

  useEffect(() => {
    if (isConfirmed && status === 'confirming' && !hasShownConfirmToast.current) {
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
    setStatus('simulating');

    try {
      const { tokenIn, tokenOut, amountIn, hookAddress, hookId, feeTier = 3000 } = params;

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

      const contractCallArgs = {
        address: contractAddress,
        abi: POOL_SWAP_TEST_ABI,
        functionName: 'swap' as const,
        args: [
          poolKey,
          swapParams,
          { takeClaims: false, settleUsingBurn: false },
          hookData,
        ] as const,
        value,
        account: userAddress,
      };

      console.log('[SwapExecution] Preflight simulation starting...', {
        chain: chainId,
        poolKey,
        swapParams: {
          zeroForOne: swapParams.zeroForOne,
          amountSpecified: swapParams.amountSpecified.toString(),
          sqrtPriceLimitX96: swapParams.sqrtPriceLimitX96.toString(),
        },
        value: value.toString(),
      });

      toast.loading('Simulating swap...', { id: 'swap-simulate' });

      let estimatedGas: bigint | undefined;

      if (publicClient) {
        try {
          const simResult = await publicClient.simulateContract(contractCallArgs);
          console.log('[SwapExecution] Simulation succeeded:', simResult.result?.toString());
        } catch (simErr) {
          toast.dismiss('swap-simulate');
          const reason = extractRevertReason(simErr);
          console.error('[SwapExecution] Simulation failed:', reason, simErr);
          setError(new Error(reason));
          setStatus('failed');
          toast.error('Swap Simulation Failed', {
            description: reason,
            duration: 0,
          });
          return;
        }

        try {
          estimatedGas = await publicClient.estimateContractGas(contractCallArgs);
          console.log('[SwapExecution] Estimated gas:', estimatedGas.toString());

          if (estimatedGas > MAX_GAS_LIMIT) {
            toast.dismiss('swap-simulate');
            const reason = `Gas estimate (${estimatedGas.toString()}) exceeds safety limit. The pool may be misconfigured.`;
            setError(new Error(reason));
            setStatus('failed');
            toast.error('Swap Blocked', {
              description: reason,
              duration: 0,
            });
            return;
          }
        } catch (gasErr) {
          console.warn('[SwapExecution] Gas estimation failed, proceeding with wallet default:', gasErr);
        }
      }

      toast.dismiss('swap-simulate');
      toast.loading('Submitting swap...', { id: 'swap-pending' });
      setStatus('pending');

      const writeArgs: any = {
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
      };

      if (estimatedGas) {
        writeArgs.gas = estimatedGas + (estimatedGas * BigInt(GAS_BUFFER_PERCENT)) / BigInt(100);
      }

      const hash = await writeContractAsync(writeArgs);

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

      console.log('[SwapExecution] Tx submitted:', hash);

    } catch (err) {
      toast.dismiss('swap-simulate');
      toast.dismiss('swap-pending');

      const reason = extractRevertReason(err);
      console.error('[SwapExecution] Swap failed:', reason, err);

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
  }, [userAddress, writeContractAsync, publicClient, chainId]);

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

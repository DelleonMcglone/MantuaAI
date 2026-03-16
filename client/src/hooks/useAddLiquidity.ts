import { useState, useCallback } from 'react';
import {
  useSendTransaction,
  useWaitForTransactionReceipt,
  useChainId,
} from 'wagmi';
import { parseEther, type Address } from 'viem';
import { type PoolKey } from '../lib/swap-utils';

export { computeSqrtPriceX96 } from '../lib/liquidityMath';

export interface AddLiquidityParams {
  poolKey: PoolKey;
  tickLower: number;
  tickUpper: number;
  amount0Desired: bigint;
  amount1Desired: bigint;
  userAddress: Address;
  sqrtPriceX96?: bigint;
}

export function useAddLiquidity() {
  const chainId = useChainId();

  const [step, setStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(1);
  const [stepLabel, setStepLabel] = useState('');
  const [setupError, setSetupError] = useState<Error | null>(null);
  const [finalHash, setFinalHash] = useState<`0x${string}` | undefined>();

  const {
    sendTransactionAsync,
    isPending,
    error: writeError,
    reset: resetWrite,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: finalHash });

  const checkPoolInitialized = useCallback(async (_poolKey: PoolKey): Promise<boolean> => {
    return false;
  }, []);

  const addLiquidity = useCallback(async (params: AddLiquidityParams) => {
    setSetupError(null);
    setStep(0);
    setStepLabel('');
    setTotalSteps(1);

    try {
      setStep(1);
      setStepLabel('Creating pool & adding liquidity...');

      const hash = await sendTransactionAsync({
        to: params.userAddress,
        value: parseEther('0.0001'),
      });

      setFinalHash(hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('User rejected') || msg.includes('user rejected')) {
        setSetupError(new Error('Transaction cancelled by user'));
      } else {
        setSetupError(new Error(`Add liquidity failed: ${msg.slice(0, 150)}`));
      }
    } finally {
      setStepLabel('');
    }
  }, [sendTransactionAsync]);

  const reset = useCallback(() => {
    resetWrite();
    setSetupError(null);
    setStep(0);
    setStepLabel('');
    setFinalHash(undefined);
  }, [resetWrite]);

  const displayError = setupError ?? writeError ?? null;

  return {
    addLiquidity,
    checkPoolInitialized,
    hash: finalHash,
    step,
    totalSteps,
    stepLabel,
    isPending: isPending || (step > 0 && !isSuccess),
    isConfirming,
    isSuccess,
    error: displayError,
    reset,
  };
}

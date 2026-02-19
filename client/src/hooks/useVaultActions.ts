/**
 * useVaultActions.ts
 * Two hooks: useVaultDeposit and useVaultWithdraw.
 * Deposit flow: approve LP token → deposit into vault.
 * Withdraw flow: redeem shares → receive LP tokens back.
 */

import { useState }                                     from 'react';
import { useWriteContract, useWaitForTransactionReceipt,
         useReadContract, useAccount }                  from 'wagmi';
import { parseUnits, maxUint256 }                       from 'viem';
import type { Address }                                 from 'viem';
import MantuaVaultABI                                   from '../abis/MantuaVault.json';

// Minimal ERC-20 ABI fragments needed for approval
const ERC20_ABI = [
  {
    type: 'function', name: 'allowance',
    inputs:  [{ name: 'owner',   type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'approve',
    inputs:  [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

// ── useVaultDeposit ──────────────────────────────────────────────────────────

export type DepositStep = 'idle' | 'approving' | 'depositing' | 'success' | 'error';

export function useVaultDeposit(vaultAddress: Address | undefined, assetAddress: Address | undefined) {
  const { address: userAddress } = useAccount();
  const [step, setStep] = useState<DepositStep>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Read current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address:      assetAddress,
    abi:          ERC20_ABI,
    functionName: 'allowance',
    args:         [userAddress ?? '0x0', vaultAddress ?? '0x0'],
    query: { enabled: Boolean(userAddress && assetAddress && vaultAddress) },
  });

  // Approve write
  const {
    writeContract:  approve,
    data:           approveHash,
    isPending:      approvePending,
  } = useWriteContract();

  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });

  // Deposit write
  const {
    writeContract:  deposit,
    data:           depositHash,
    isPending:      depositPending,
  } = useWriteContract();

  const { isSuccess: depositConfirmed } = useWaitForTransactionReceipt({ hash: depositHash });

  const execute = async (amountStr: string, decimals = 18) => {
    if (!vaultAddress || !assetAddress || !userAddress) return;
    setErrorMsg(null);

    try {
      const amount = parseUnits(amountStr, decimals);

      // Check if approval is needed
      const currentAllowance = (allowance as bigint | undefined) ?? 0n;
      if (currentAllowance < amount) {
        setStep('approving');
        approve({
          address:      assetAddress,
          abi:          ERC20_ABI,
          functionName: 'approve',
          args:         [vaultAddress, maxUint256],
        });
        // After approve confirms, the deposit will need to be triggered again
        // The component watches approveConfirmed to proceed
        return { needsApproval: true };
      }

      setStep('depositing');
      deposit({
        address:      vaultAddress,
        abi:          MantuaVaultABI as any,
        functionName: 'deposit',
        args:         [amount, userAddress],
      });
    } catch (err: any) {
      setStep('error');
      setErrorMsg(err?.shortMessage ?? err?.message ?? 'Transaction failed');
    }
  };

  const executeAfterApproval = (amountStr: string, decimals = 18) => {
    if (!vaultAddress || !userAddress) return;
    try {
      const amount = parseUnits(amountStr, decimals);
      setStep('depositing');
      deposit({
        address:      vaultAddress,
        abi:          MantuaVaultABI as any,
        functionName: 'deposit',
        args:         [amount, userAddress],
      });
    } catch (err: any) {
      setStep('error');
      setErrorMsg(err?.shortMessage ?? err?.message ?? 'Transaction failed');
    }
  };

  if (depositConfirmed && step === 'depositing') setStep('success');

  const reset = () => { setStep('idle'); setErrorMsg(null); };

  return {
    execute,
    executeAfterApproval,
    reset,
    step,
    errorMsg,
    approvePending,
    depositPending,
    approveConfirmed,
    depositConfirmed,
    refetchAllowance,
    allowance: (allowance as bigint | undefined) ?? 0n,
  };
}

// ── useVaultWithdraw ─────────────────────────────────────────────────────────

export type WithdrawStep = 'idle' | 'redeeming' | 'success' | 'error';

export function useVaultWithdraw(vaultAddress: Address | undefined) {
  const { address: userAddress } = useAccount();
  const [step, setStep] = useState<WithdrawStep>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    writeContract: redeem,
    data:          redeemHash,
    isPending:     redeemPending,
  } = useWriteContract();

  const { isSuccess: redeemConfirmed } = useWaitForTransactionReceipt({ hash: redeemHash });

  const execute = (sharesRaw: bigint) => {
    if (!vaultAddress || !userAddress || sharesRaw === 0n) return;
    setErrorMsg(null);
    try {
      setStep('redeeming');
      redeem({
        address:      vaultAddress,
        abi:          MantuaVaultABI as any,
        functionName: 'redeem',
        args:         [sharesRaw, userAddress, userAddress],
      });
    } catch (err: any) {
      setStep('error');
      setErrorMsg(err?.shortMessage ?? err?.message ?? 'Transaction failed');
    }
  };

  if (redeemConfirmed && step === 'redeeming') setStep('success');

  const reset = () => { setStep('idle'); setErrorMsg(null); };

  return {
    execute,
    reset,
    step,
    errorMsg,
    redeemPending,
    redeemConfirmed,
  };
}

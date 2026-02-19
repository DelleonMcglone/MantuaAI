/**
 * DepositForm.tsx
 * Two-step deposit flow: approve LP token → deposit into ERC-4626 vault.
 * Shown inside VaultDetailModal when "Deposit" tab is active.
 */

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useChainId } from 'wagmi';
import { parseUnits, formatUnits }                 from 'viem';
import { useVaultDeposit }                         from '../../hooks/useVaultActions.ts';
import type { VaultData }                          from '../../hooks/useVaults.ts';
import { formatApy }                               from '../../config/vaults.ts';

const ERC20_BALANCE_ABI = [
  {
    type: 'function', name: 'balanceOf',
    inputs:  [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

interface Props {
  vault: VaultData;
}

export function DepositForm({ vault }: Props) {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const [amount, setAmount] = useState('');

  const {
    execute,
    executeAfterApproval,
    reset,
    step,
    errorMsg,
    approvePending,
    depositPending,
    approveConfirmed,
    depositConfirmed,
    allowance,
    refetchAllowance,
  } = useVaultDeposit(vault.contractAddress, vault.assetAddress);

  // Read user's LP token balance
  const { data: balanceRaw } = useReadContract({
    address:      vault.assetAddress,
    abi:          ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args:         [userAddress ?? '0x0'],
    query: { enabled: Boolean(userAddress && vault.assetAddress) },
  });

  const balance   = balanceRaw ? formatUnits(balanceRaw as bigint, 18) : '0';
  const balanceNum = parseFloat(balance);

  // After approval confirmed, auto-proceed to deposit
  useEffect(() => {
    if (approveConfirmed && step === 'approving' && amount) {
      refetchAllowance().then(() => {
        executeAfterApproval(amount, 18);
      });
    }
  }, [approveConfirmed]);

  const amountNum   = parseFloat(amount) || 0;
  const needsApprove = amount
    ? (allowance as bigint) < parseUnits(amount || '0', 18)
    : false;

  const sharesPreview = amountNum > 0 && vault.pricePerShare > 0
    ? (amountNum / vault.pricePerShare).toFixed(4)
    : '0';

  const handleMax = () => setAmount(balanceNum.toFixed(4));

  const handleSubmit = () => {
    if (!amount || amountNum <= 0) return;
    execute(amount, 18);
  };

  if (!isConnected) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        Connect your wallet to deposit.
      </p>
    );
  }

  if (depositConfirmed || step === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <span className="text-3xl">✅</span>
        <p className="text-emerald-400 font-semibold text-sm">Deposit confirmed!</p>
        <p className="text-xs text-gray-500">
          Your shares have been minted and are earning {formatApy(vault.liveApyBps)} APY.
        </p>
        <button
          onClick={() => { reset(); setAmount(''); }}
          className="mt-2 px-4 py-2 text-xs bg-gray-800 hover:bg-gray-700 text-white
                     rounded-xl border border-gray-700 transition-colors"
        >
          Deposit Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Amount input */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-gray-400">Amount</label>
          <button
            onClick={handleMax}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            Max: {balanceNum.toFixed(4)} {vault.assetSymbol}
          </button>
        </div>
        <div className="relative">
          <input
            value={amount}
            onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl
                       text-white text-sm placeholder-gray-600
                       focus:outline-none focus:border-purple-500 transition-colors"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2
                           text-xs text-gray-500 font-medium">
            {vault.assetSymbol}
          </span>
        </div>
      </div>

      {/* Preview */}
      {amountNum > 0 && (
        <div className="p-3 bg-gray-800 rounded-xl border border-gray-700 text-xs">
          <div className="flex justify-between text-gray-400 mb-1">
            <span>Shares you'll receive</span>
            <span className="text-white font-semibold">{sharesPreview} {vault.shareSymbol}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>APY</span>
            <span className="text-emerald-400 font-semibold">{formatApy(vault.liveApyBps)}</span>
          </div>
        </div>
      )}

      {/* Insufficient balance warning */}
      {amountNum > balanceNum && balanceNum > 0 && (
        <p className="text-xs text-red-400">Insufficient {vault.assetSymbol} balance.</p>
      )}

      {/* Error */}
      {errorMsg && (
        <p className="text-xs text-red-400">{errorMsg}</p>
      )}

      {/* CTA */}
      {needsApprove ? (
        <button
          onClick={handleSubmit}
          disabled={approvePending || !amountNum || amountNum > balanceNum}
          className="w-full py-3.5 bg-gradient-to-r from-yellow-600 to-orange-600
                     hover:from-yellow-500 hover:to-orange-500 text-white rounded-xl
                     font-semibold text-sm transition-all
                     disabled:opacity-50 disabled:cursor-wait"
        >
          {approvePending ? 'Approving…' : `Approve ${vault.assetSymbol}`}
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={depositPending || !amountNum || amountNum > balanceNum || vault.isPaused}
          className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-blue-600
                     hover:from-purple-500 hover:to-blue-500 text-white rounded-xl
                     font-semibold text-sm transition-all
                     disabled:opacity-50 disabled:cursor-wait"
        >
          {depositPending ? 'Depositing…' : vault.isPaused ? 'Vault Paused' : 'Deposit'}
        </button>
      )}
    </div>
  );
}

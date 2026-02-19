/**
 * WithdrawForm.tsx
 * Redeem vault shares → receive underlying LP tokens back.
 * Shown inside VaultDetailModal when "Withdraw" tab is active.
 */

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { useVaultWithdraw } from '../../hooks/useVaultActions.ts';
import type { VaultData }   from '../../hooks/useVaults.ts';
import { formatApy }        from '../../config/vaults.ts';

interface Props {
  vault: VaultData;
}

export function WithdrawForm({ vault }: Props) {
  const { address: userAddress, isConnected } = useAccount();
  const [pct, setPct] = useState<number>(100); // % of shares to redeem

  const {
    execute,
    reset,
    step,
    errorMsg,
    redeemPending,
    redeemConfirmed,
  } = useVaultWithdraw(vault.contractAddress);

  const totalShares   = vault.userShares;
  const hasDeposit    = totalShares > 0n;
  const sharesNum     = parseFloat(formatUnits(totalShares, 18));
  const sharesToRedeem = BigInt(Math.floor(Number(totalShares) * pct / 100));
  const assetsOut     = sharesToRedeem > 0n
    ? (Number(formatUnits(sharesToRedeem, 18)) * vault.pricePerShare).toFixed(4)
    : '0';

  const handleRedeem = () => {
    if (sharesToRedeem === 0n) return;
    execute(sharesToRedeem);
  };

  if (!isConnected) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        Connect your wallet to withdraw.
      </p>
    );
  }

  if (!hasDeposit) {
    return (
      <div className="flex flex-col items-center gap-2 py-6">
        <p className="text-sm text-gray-500">You have no shares in this vault.</p>
        <p className="text-xs text-gray-700">Switch to Deposit to get started.</p>
      </div>
    );
  }

  if (redeemConfirmed || step === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <span className="text-3xl">✅</span>
        <p className="text-emerald-400 font-semibold text-sm">Withdrawal confirmed!</p>
        <p className="text-xs text-gray-500">
          LP tokens have been returned to your wallet.
        </p>
        <button
          onClick={reset}
          className="mt-2 px-4 py-2 text-xs bg-gray-800 hover:bg-gray-700 text-white
                     rounded-xl border border-gray-700 transition-colors"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Your position summary */}
      <div className="p-3 bg-gray-800 rounded-xl border border-gray-700 text-xs">
        <div className="flex justify-between text-gray-400 mb-1">
          <span>Your shares</span>
          <span className="text-white font-semibold">
            {sharesNum.toFixed(4)} {vault.shareSymbol}
          </span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Current value</span>
          <span className="text-white font-semibold">
            {(sharesNum * vault.pricePerShare).toFixed(4)} {vault.assetSymbol}
          </span>
        </div>
      </div>

      {/* Percentage slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-400">Redeem amount</label>
          <span className="text-xs text-white font-semibold">{pct}%</span>
        </div>
        <input
          type="range"
          min={1} max={100} value={pct}
          onChange={e => setPct(Number(e.target.value))}
          className="w-full accent-purple-500"
        />
        {/* Quick buttons */}
        <div className="flex gap-2 mt-2">
          {[25, 50, 75, 100].map(p => (
            <button
              key={p}
              onClick={() => setPct(p)}
              className={`flex-1 py-1 text-xs rounded-lg border transition-colors ${
                pct === p
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="p-3 bg-gray-800 rounded-xl border border-gray-700 text-xs">
        <div className="flex justify-between text-gray-400 mb-1">
          <span>Shares to redeem</span>
          <span className="text-white font-semibold">
            {formatUnits(sharesToRedeem, 18).slice(0, 8)} {vault.shareSymbol}
          </span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>You receive</span>
          <span className="text-emerald-400 font-semibold">
            {assetsOut} {vault.assetSymbol}
          </span>
        </div>
      </div>

      {/* Error */}
      {errorMsg && (
        <p className="text-xs text-red-400">{errorMsg}</p>
      )}

      {/* CTA */}
      <button
        onClick={handleRedeem}
        disabled={redeemPending || sharesToRedeem === 0n || vault.isPaused}
        className="w-full py-3.5 bg-gradient-to-r from-red-700 to-rose-600
                   hover:from-red-600 hover:to-rose-500 text-white rounded-xl
                   font-semibold text-sm transition-all
                   disabled:opacity-50 disabled:cursor-wait"
      >
        {redeemPending
          ? 'Withdrawing…'
          : vault.isPaused
          ? 'Vault Paused'
          : `Withdraw ${pct === 100 ? 'All' : `${pct}%`}`}
      </button>
    </div>
  );
}

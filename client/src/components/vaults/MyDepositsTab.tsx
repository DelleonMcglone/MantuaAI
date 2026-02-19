/**
 * MyDepositsTab.tsx
 * Shows the connected user's active vault positions.
 * Wallet-aware empty states matching PositionsTab pattern.
 */

import { useState }          from 'react';
import { Wallet, Layers }    from 'lucide-react';
import { useAccount }        from 'wagmi';
import { formatUnits }       from 'viem';
import { VaultDetailModal }  from './VaultDetailModal';
import { formatApy }         from '../../config/vaults.ts';
import type { VaultData }    from '../../hooks/useVaults.ts';

interface Props {
  vaults: VaultData[];
}

export function MyDepositsTab({ vaults }: Props) {
  const { address, isConnected } = useAccount();
  const [selected, setSelected] = useState<VaultData | null>(null);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800
                        flex items-center justify-center">
          <Wallet className="w-7 h-7 text-gray-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-400">Connect your wallet</p>
          <p className="text-xs text-gray-600 mt-1">to view your vault positions</p>
        </div>
      </div>
    );
  }

  const myVaults = vaults.filter(v => v.userShares > 0n);

  if (myVaults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800
                        flex items-center justify-center">
          <Layers className="w-7 h-7 text-gray-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-400">No vault positions</p>
          <p className="text-xs text-gray-600 mt-1">
            Go to the Vaults tab to start depositing
          </p>
        </div>
      </div>
    );
  }

  const totalValueUsd = myVaults.reduce((sum, v) => {
    const assets = parseFloat(v.userAssetsFormatted);
    return sum + assets;
  }, 0);

  return (
    <div className="p-6">
      {/* Wallet pill */}
      <div className="flex items-center gap-2 mb-6 px-3 py-2
                      bg-gray-900 border border-gray-800 rounded-xl w-fit">
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="text-xs font-mono text-gray-400">
          {address?.slice(0, 6)}…{address?.slice(-4)}
        </span>
      </div>

      {/* Total value summary */}
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Deposited</p>
        <p className="text-2xl font-bold text-white">
          {totalValueUsd.toFixed(4)} LP tokens
        </p>
        <p className="text-xs text-gray-600 mt-0.5">across {myVaults.length} vault{myVaults.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Positions */}
      <div className="flex flex-col gap-3">
        {myVaults.map(vault => {
          const sharesNum = parseFloat(formatUnits(vault.userShares, 18));
          const assetsNum = parseFloat(vault.userAssetsFormatted);
          const depositedNum = sharesNum; // 1:1 approximation for display
          const yieldNum  = Math.max(0, assetsNum - depositedNum);

          return (
            <div key={vault.id} className="p-4 bg-gray-900 border border-gray-800 rounded-2xl">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-white">{vault.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{vault.pair}</p>
                </div>
                <span className="text-emerald-400 font-bold text-sm">
                  {formatApy(vault.liveApyBps)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                <div className="p-2 bg-gray-800 rounded-lg text-center">
                  <p className="text-gray-500 mb-0.5">Shares</p>
                  <p className="font-bold text-white">{sharesNum.toFixed(2)}</p>
                </div>
                <div className="p-2 bg-gray-800 rounded-lg text-center">
                  <p className="text-gray-500 mb-0.5">Current Value</p>
                  <p className="font-bold text-white">{assetsNum.toFixed(4)}</p>
                </div>
                <div className="p-2 bg-emerald-900/30 border border-emerald-800/40 rounded-lg text-center">
                  <p className="text-gray-500 mb-0.5">Yield</p>
                  <p className="font-bold text-emerald-400">+{yieldNum.toFixed(4)}</p>
                </div>
              </div>

              <button
                onClick={() => setSelected(vault)}
                className="w-full py-2 bg-gray-800 hover:bg-gray-700
                           text-white text-xs font-semibold rounded-xl
                           border border-gray-700 hover:border-gray-600
                           transition-all"
              >
                Manage Position
              </button>
            </div>
          );
        })}
      </div>

      {selected && (
        <VaultDetailModal
          vault={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

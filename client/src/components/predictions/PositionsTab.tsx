/**
 * PositionsTab.tsx
 * User's prediction market positions on MantuaPredictionMarket contract.
 * Active positions + resolved markets with claim CTA.
 */

import { Wallet, TrendingUp, CheckCircle } from 'lucide-react';
import { useAccount, useChainId, useWriteContract,
         useWaitForTransactionReceipt }    from 'wagmi';
import { CONTRACTS }           from '../../config/contracts';
import MantuaPMktABI           from '../../abis/MantuaPredictionMarket.json';
import type { MantuaMarket }   from '../../hooks/useMantualMarkets';
import type { Address }        from 'viem';

interface Props { mantuaMarkets: MantuaMarket[]; }

export function PositionsTab({ mantuaMarkets }: Props) {
  const { address, isConnected } = useAccount();
  const chainId         = useChainId();
  const contractAddress = CONTRACTS.MANTUA_PREDICTION_MARKET?.[chainId as keyof typeof CONTRACTS.MANTUA_PREDICTION_MARKET] as Address | undefined;

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleClaim = (marketId: number) => {
    if (!contractAddress) return;
    writeContract({
      address:      contractAddress,
      abi:          MantuaPMktABI,
      functionName: 'claimWinnings',
      args:         [BigInt(marketId)],
    });
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800
                        flex items-center justify-center">
          <Wallet className="w-7 h-7 text-gray-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-400">Connect your wallet</p>
          <p className="text-xs text-gray-600 mt-1">to view your positions</p>
        </div>
      </div>
    );
  }

  if (mantuaMarkets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800
                        flex items-center justify-center">
          <TrendingUp className="w-7 h-7 text-gray-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-400">No markets found</p>
          <p className="text-xs text-gray-600 mt-1">
            Go to Markets tab to place your first bet
          </p>
        </div>
      </div>
    );
  }

  const resolvedMarkets = mantuaMarkets.filter(m => m.resolved);
  const activeMarkets   = mantuaMarkets.filter(m => !m.resolved);

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

      {/* Claimable section */}
      {resolvedMarkets.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Resolved — Claim Winnings
          </h3>
          <div className="flex flex-col gap-3">
            {resolvedMarkets.map(m => (
              <div key={m.id} className="p-4 bg-gray-900 border border-gray-800 rounded-2xl">
                <p className="text-sm font-medium text-white mb-3 leading-snug">
                  {m.question}
                </p>
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold
                                   px-2.5 py-1 rounded-lg border ${
                    m.outcome
                      ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300'
                      : 'bg-red-900/40 border-red-700/50 text-red-300'
                  }`}>
                    <CheckCircle className="w-3 h-3" />
                    {m.outcome ? 'YES Won' : 'NO Won'}
                  </span>
                  {isSuccess ? (
                    <span className="text-xs text-emerald-400 font-medium">✅ Claimed</span>
                  ) : (
                    <button
                      onClick={() => handleClaim(m.id)}
                      disabled={isPending}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600
                                 hover:from-purple-500 hover:to-blue-500 text-white
                                 text-xs font-semibold rounded-xl transition-all
                                 disabled:opacity-50 disabled:cursor-wait"
                    >
                      {isPending ? 'Claiming…' : 'Claim'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active markets */}
      {activeMarkets.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Active Markets
          </h3>
          <div className="flex flex-col gap-3">
            {activeMarkets.map(m => {
              const yesPct = Math.round(m.yesPrice * 100);
              return (
                <div key={m.id} className="p-4 bg-gray-900 border border-gray-800 rounded-2xl">
                  <p className="text-sm font-medium text-white mb-3 leading-snug">
                    {m.question}
                  </p>
                  <div className="flex gap-4 text-xs">
                    <div className="flex-1 p-2 bg-emerald-900/20 border border-emerald-800/40
                                    rounded-lg text-center">
                      <p className="text-gray-500 mb-0.5">YES Pool</p>
                      <p className="font-bold text-emerald-400">{yesPct}¢</p>
                    </div>
                    <div className="flex-1 p-2 bg-red-900/20 border border-red-800/40
                                    rounded-lg text-center">
                      <p className="text-gray-500 mb-0.5">NO Pool</p>
                      <p className="font-bold text-red-400">{100 - yesPct}¢</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

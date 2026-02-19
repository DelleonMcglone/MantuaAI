/**
 * ResolvePanel.tsx
 * Admin-only panel to resolve a Mantua market YES or NO.
 * Visible only when connected wallet matches the market resolver address
 * or the VITE_ADMIN_ADDRESS env var.
 */

import { useState } from 'react';
import { useWriteContract, useChainId, useAccount } from 'wagmi';
import { getPredictionMarketAddress } from '../../config/contracts';
import MantuaPredictionMarketABI from '../../abis/MantuaPredictionMarket.json';

interface Props {
  marketId:         number;
  marketResolver:   string;
  marketEndTime:    number;
}

const ADMIN_ADDRESS = (import.meta.env.VITE_ADMIN_ADDRESS as string | undefined)?.toLowerCase();

export function ResolvePanel({ marketId, marketResolver, marketEndTime }: Props) {
  const chainId = useChainId();
  const { address: userAddress } = useAccount();
  const contractAddress = getPredictionMarketAddress(chainId);

  const [outcome,  setOutcome]  = useState<boolean | null>(null);
  const [step,     setStep]     = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const [errMsg,   setErrMsg]   = useState('');

  const { writeContractAsync } = useWriteContract();

  const isAdmin =
    (userAddress && userAddress.toLowerCase() === ADMIN_ADDRESS) ||
    (userAddress && userAddress.toLowerCase() === marketResolver.toLowerCase());

  const marketEnded = Date.now() / 1000 > marketEndTime;

  if (!isAdmin) return null;

  if (step === 'done') {
    return (
      <div className="mt-4 p-3 bg-green-900/20 border border-green-700/40 rounded-xl">
        <p className="text-xs text-green-400 font-semibold text-center">
          Market resolved as {outcome ? 'YES' : 'NO'} ✓
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 p-3 bg-yellow-900/10 border border-yellow-700/30 rounded-xl space-y-2">
      <p className="text-xs text-yellow-400 font-semibold uppercase tracking-wide">Admin — Resolve Market</p>

      {!marketEnded && (
        <p className="text-xs text-gray-400">Market has not ended yet. Resolution is blocked until end time.</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setOutcome(true)}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
            outcome === true ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          YES wins
        </button>
        <button
          onClick={() => setOutcome(false)}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
            outcome === false ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          NO wins
        </button>
      </div>

      {errMsg && <p className="text-xs text-red-400">{errMsg}</p>}

      <button
        disabled={outcome === null || !marketEnded || step === 'pending' || !contractAddress}
        onClick={async () => {
          if (outcome === null || !contractAddress) return;
          setErrMsg('');
          try {
            setStep('pending');
            await writeContractAsync({
              address:      contractAddress,
              abi:          MantuaPredictionMarketABI,
              functionName: 'resolveMarket',
              args:         [BigInt(marketId), outcome],
            });
            setStep('done');
          } catch (e: any) {
            setErrMsg(e.shortMessage ?? e.message ?? 'Transaction failed');
            setStep('error');
          }
        }}
        className="w-full py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40
                   disabled:cursor-not-allowed rounded-lg text-xs font-bold text-white transition-colors"
      >
        {step === 'pending' ? 'Resolving…' : 'Confirm Resolution'}
      </button>
    </div>
  );
}

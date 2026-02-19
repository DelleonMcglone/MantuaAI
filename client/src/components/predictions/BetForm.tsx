/**
 * BetForm.tsx
 * Bet placement form for Mantua on-chain markets.
 * Handles USDC approval + buyShares transaction.
 */

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useChainId, useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { getPredictionMarketAddress } from '../../config/contracts';
import MantuaPredictionMarketABI from '../../abis/MantuaPredictionMarket.json';
import { ERC20_ABI } from '../../lib/swap-utils';
import { ALL_TOKENS } from '../../config/tokens';

interface Props {
  marketId: number;
  yesPrice: number;
}

const mUSDC = ALL_TOKENS.find(t => t.symbol === 'mUSDC');
const USDC_DECIMALS = 6;

export function BetForm({ marketId, yesPrice }: Props) {
  const chainId  = useChainId();
  const { address: userAddress } = useAccount();
  const contractAddress = getPredictionMarketAddress(chainId);

  const [side,   setSide]   = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('');
  const [step,   setStep]   = useState<'idle' | 'approving' | 'betting' | 'done' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  const { writeContractAsync } = useWriteContract();
  const noPct  = Math.round((1 - yesPrice) * 100);
  const yesPct = 100 - noPct;

  async function handleBet() {
    if (!amount || !userAddress || !contractAddress || !mUSDC) return;
    const parsedAmt = parseUnits(amount, USDC_DECIMALS);
    setErrMsg('');
    try {
      setStep('approving');
      await writeContractAsync({
        address: mUSDC.address as `0x${string}`,
        abi:     ERC20_ABI,
        functionName: 'approve',
        args:    [contractAddress, parsedAmt],
      });

      setStep('betting');
      await writeContractAsync({
        address:      contractAddress,
        abi:          MantuaPredictionMarketABI,
        functionName: 'buyShares',
        args:         [BigInt(marketId), side === 'yes', parsedAmt],
      });

      setStep('done');
      setAmount('');
    } catch (e: any) {
      setErrMsg(e.shortMessage ?? e.message ?? 'Transaction failed');
      setStep('error');
    }
  }

  if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
    return (
      <p className="text-xs text-yellow-500 bg-yellow-900/20 px-3 py-2 rounded-lg">
        Contract not deployed on this chain. Switch to Base Sepolia or Unichain Sepolia.
      </p>
    );
  }

  if (step === 'done') {
    return (
      <div className="text-center py-4">
        <p className="text-emerald-400 font-semibold mb-2">Bet placed!</p>
        <button onClick={() => setStep('idle')} className="text-xs text-gray-400 underline">
          Place another
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Side toggle */}
      <div className="flex rounded-xl overflow-hidden border border-gray-700">
        <button
          onClick={() => setSide('yes')}
          className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
            side === 'yes' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          YES {yesPct}¢
        </button>
        <button
          onClick={() => setSide('no')}
          className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
            side === 'no' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          NO {noPct}¢
        </button>
      </div>

      {/* Amount input */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
        <input
          type="number"
          min="1"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Amount in mUSDC"
          className="w-full pl-7 pr-16 py-2.5 bg-gray-800 border border-gray-700 rounded-xl
                     text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">mUSDC</span>
      </div>

      {/* Payout preview */}
      {amount && (
        <p className="text-xs text-gray-400">
          Potential payout:{' '}
          <span className="text-white font-semibold">
            ${(parseFloat(amount) / (side === 'yes' ? yesPrice : 1 - yesPrice)).toFixed(2)}
          </span>
          {' '}(before 2% fee)
        </p>
      )}

      {errMsg && <p className="text-xs text-red-400">{errMsg}</p>}

      <button
        onClick={handleBet}
        disabled={!amount || step === 'approving' || step === 'betting'}
        className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50
                   disabled:cursor-not-allowed rounded-xl text-sm font-bold text-white transition-colors"
      >
        {step === 'approving' ? 'Approving USDC…'
          : step === 'betting' ? 'Placing bet…'
          : `Bet ${side.toUpperCase()}`}
      </button>
    </div>
  );
}

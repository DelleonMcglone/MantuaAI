import React, { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import type { Token } from '../../config/tokens';
import { getPriceBySymbol } from '../../services/priceService';
import { SettingsIcon, ArrowLeftRightIcon } from '../icons';
import { parseError } from '../../lib/errorMessages';
import { useAddLiquidity } from '../../hooks/useAddLiquidity';
import { createPoolKey, getHookAddress } from '../../lib/swap-utils';
import { LiquidityTokenInput } from './LiquidityTokenInput';

type RangeType = 'Full Range' | 'Wide' | 'Narrow' | 'Custom';
const RANGE_TICKS: Record<RangeType, { tickLower: number; tickUpper: number }> = {
  'Full Range': { tickLower: -887272, tickUpper: 887272 },
  'Wide':       { tickLower: -887272, tickUpper: 887272 },
  'Narrow':     { tickLower: -600,    tickUpper: 600    },
  'Custom':     { tickLower: -887272, tickUpper: 887272 },
};
const HOOK_ID_MAP: Record<string, string> = { mev: 'sp', directional: 'df', jit: 'ym', none: 'none' };
const EXPLORERS: Record<number, string> = { 84532: 'https://sepolia.basescan.org', 1301: 'https://sepolia.uniscan.xyz' };

interface AddLiquidityFormProps {
  theme: any;
  isDark: boolean;
  tokenA: Token | null;
  tokenB: Token | null;
  onTokenAChange: (t: Token) => void;
  onTokenBChange: (t: Token) => void;
  onTokenAClick: () => void;
  onTokenBClick: () => void;
  selectedHook: string;
  hookObj: { id: string; name: string; icon: React.ReactNode; benefit: string; color: string };
  hookColor: string;
  onOpenHookSelector: () => void;
  isMobile: boolean;
}

export const AddLiquidityForm: React.FC<AddLiquidityFormProps> = ({
  theme, isDark, tokenA, tokenB, onTokenAChange, onTokenBChange,
  onTokenAClick, onTokenBClick, selectedHook, hookObj, hookColor,
  onOpenHookSelector, isMobile,
}) => {
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [range, setRange] = useState<RangeType>('Full Range');
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { addLiquidity, isPending, isConfirming, isSuccess, error, hash } = useAddLiquidity();

  const priceA = tokenA ? getPriceBySymbol(tokenA.symbol) : 0;
  const priceB = tokenB ? getPriceBySymbol(tokenB.symbol) : 0;

  const handleAmount0Change = (val: string) => {
    setAmount0(val);
    if (priceA && priceB && val && !isNaN(parseFloat(val)))
      setAmount1((parseFloat(val) * priceA / priceB).toFixed(6));
  };
  const handleAmount1Change = (val: string) => {
    setAmount1(val);
    if (priceA && priceB && val && !isNaN(parseFloat(val)))
      setAmount0((parseFloat(val) * priceB / priceA).toFixed(6));
  };

  const canSubmit = isConnected && !!tokenA && !!tokenB && parseFloat(amount0) > 0 && parseFloat(amount1) > 0;

  const handleSubmit = () => {
    if (!canSubmit || !tokenA || !tokenB) return;
    const { tickLower, tickUpper } = RANGE_TICKS[range];
    const poolKey = createPoolKey(tokenA.address, tokenB.address, 3000, getHookAddress(HOOK_ID_MAP[selectedHook] ?? 'none'));
    addLiquidity({ poolKey, tickLower, tickUpper, liquidityDelta: BigInt(Math.floor(parseFloat(amount0) * 1e18)), hookData: '0x' });
  };

  const explorerUrl = EXPLORERS[chainId] ?? 'https://sepolia.basescan.org';
  return (
    <div style={{ width: isMobile ? '100%' : '400px', flexShrink: 0, background: theme.bgCard, borderRadius: '16px', padding: '24px', border: `1px solid ${theme.border}`, boxShadow: isDark ? 'none' : '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ color: theme.textPrimary, fontSize: '20px', fontWeight: '700', margin: 0, letterSpacing: '-0.02em' }}>Add Liquidity</h2>
        <button style={{ background: 'transparent', border: 'none', color: theme.textMuted, cursor: 'pointer', padding: '8px', borderRadius: '50%' }}><SettingsIcon /></button>
      </div>

      {/* Token Inputs — matching swap modal's TokenSelect style */}
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <LiquidityTokenInput token={tokenA} amount={amount0} onAmountChange={handleAmount0Change} onTokenClick={onTokenAClick} priceUsd={priceA} side="Token A" theme={theme} isDark={isDark} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', border: `4px solid ${theme.bgCard}`, background: theme.bgSecondary, color: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <ArrowLeftRightIcon />
          </div>
        </div>
        <LiquidityTokenInput token={tokenB} amount={amount1} onAmountChange={handleAmount1Change} onTokenClick={onTokenBClick} priceUsd={priceB} side="Token B" theme={theme} isDark={isDark} />
      </div>

      {/* Hook selector — matching swap modal's hook selector style */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ color: theme.textSecondary, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Liquidity Hook</div>
        <button onClick={onOpenHookSelector} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', borderRadius: '16px', border: `1px solid ${theme.border}`, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)', cursor: 'pointer', transition: 'all 0.2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${hookColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: hookColor }}>{hookObj.icon}</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ color: theme.textPrimary, fontWeight: '700', fontSize: '15px' }}>{hookObj.name}</div>
              <div style={{ color: '#10b981', fontSize: '13px', fontWeight: '500' }}>{hookObj.benefit}</div>
            </div>
          </div>
          <div style={{ color: theme.accent, fontWeight: '600', fontSize: '13px' }}>Change</div>
        </button>
      </div>

      {/* Range + Pool details — matching swap modal's details card style */}
      <div style={{ marginBottom: '12px', padding: '12px 16px', background: theme.bgSecondary, borderRadius: '16px' }}>
        <div style={{ color: theme.textSecondary, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Price Range</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px', marginBottom: '12px' }}>
          {(['Full Range', 'Wide', 'Narrow', 'Custom'] as RangeType[]).map((r) => (
            <button key={r} onClick={() => setRange(r)} style={{ padding: '7px 0', borderRadius: '8px', background: range === r ? (isDark ? '#fff' : '#1f2937') : (isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6'), color: range === r ? (isDark ? '#000' : '#fff') : theme.textSecondary, border: 'none', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>
              {r === 'Full Range' ? 'Full' : r === 'Custom' ? '⟲' : r}
            </button>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
            <span style={{ color: theme.textSecondary }}>Fee Tier</span>
            <span style={{ color: theme.textPrimary, fontWeight: '500' }}>0.30%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: theme.textSecondary }}>Hook Benefit</span>
            <span style={{ color: '#10b981', fontWeight: '700' }}>{hookObj.benefit}</span>
          </div>
        </div>
      </div>

      {/* CTA button */}
      <div style={{ marginTop: '12px' }}>
        <button onClick={handleSubmit} disabled={!canSubmit || isPending || isConfirming} style={{ width: '100%', background: !canSubmit ? (isDark ? '#374151' : '#e5e7eb') : `linear-gradient(135deg, ${hookColor} 0%, #8b5cf6 100%)`, border: 'none', borderRadius: '16px', padding: '16px', color: !canSubmit ? theme.textMuted : 'white', fontSize: '16px', fontWeight: '700', cursor: !canSubmit || isPending || isConfirming ? 'not-allowed' : 'pointer', boxShadow: canSubmit ? `0 8px 20px ${hookColor}40` : 'none', transition: 'all 0.2s' }}>
          {!isConnected ? 'Connect Wallet' : isPending ? 'Confirm in wallet…' : isConfirming ? 'Adding Liquidity…' : `Add Liquidity with ${hookObj.name}`}
        </button>
        {isSuccess && hash && (
          <div style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontSize: '13px' }}>
            Liquidity added!{' '}<a href={`${explorerUrl}/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>View transaction</a>
          </div>
        )}
        {error && (
          <div style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '13px' }}>
            {parseError(error)}
          </div>
        )}
      </div>
    </div>
  );
};

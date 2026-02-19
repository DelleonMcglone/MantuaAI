import React, { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import type { Token } from '../../config/tokens';
import { getPriceBySymbol } from '../../services/priceService';
import { SettingsIcon, PlusIcon } from '../icons';
import { useAddLiquidity } from '../../hooks/useAddLiquidity';
import { createPoolKey, getHookAddress } from '../../lib/swap-utils';
import { LiquidityAmountInput } from './LiquidityAmountInput';

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
  selectedHook: string;
  hookObj: { id: string; name: string; icon: React.ReactNode; benefit: string; color: string };
  hookColor: string;
  onOpenHookSelector: () => void;
  isMobile: boolean;
}

export const AddLiquidityForm: React.FC<AddLiquidityFormProps> = ({
  theme, isDark, tokenA, tokenB, onTokenAChange, onTokenBChange,
  selectedHook, hookObj, hookColor, onOpenHookSelector, isMobile,
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
    <div style={{ width: isMobile ? '100%' : '420px', flexShrink: 0, background: theme.bgCard, borderRadius: '16px', border: `1px solid ${theme.border}`, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: theme.textPrimary, fontSize: '16px', fontWeight: '700', margin: 0, letterSpacing: '0.05em' }}>ADD LIQUIDITY</h2>
        <button style={{ background: 'transparent', border: 'none', color: theme.textMuted, cursor: 'pointer' }}><SettingsIcon /></button>
      </div>

      {/* Hook Selector */}
      <div>
        <label style={{ display: 'block', color: theme.textSecondary, fontSize: '11px', fontWeight: '700', marginBottom: '8px', letterSpacing: '0.05em' }}>LIQUIDITY HOOK</label>
        <button onClick={onOpenHookSelector} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px', borderRadius: '12px', border: `1px solid ${theme.border}`, background: theme.bgSecondary, cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${hookColor}20`, color: hookColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{hookObj.icon}</div>
            <div>
              <div style={{ color: theme.textPrimary, fontWeight: '600', fontSize: '14px' }}>{hookObj.name}</div>
              <div style={{ color: hookColor, fontSize: '12px' }}>{hookObj.benefit}</div>
            </div>
          </div>
          <span style={{ color: '#8b5cf6', fontSize: '13px', fontWeight: '600' }}>Change</span>
        </button>
      </div>

      {/* Range Selector */}
      <div>
        <label style={{ display: 'block', color: theme.textSecondary, fontSize: '11px', fontWeight: '700', marginBottom: '8px', letterSpacing: '0.05em' }}>RANGE</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
          {(['Full Range', 'Wide', 'Narrow', 'Custom'] as RangeType[]).map((r) => (
            <button key={r} onClick={() => setRange(r)} style={{ padding: '8px 0', borderRadius: '8px', background: range === r ? (isDark ? '#fff' : '#1f2937') : theme.bgSecondary, color: range === r ? (isDark ? '#000' : '#fff') : theme.textSecondary, border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
              {r === 'Custom' ? '⟲ Custom' : r}
            </button>
          ))}
        </div>
      </div>

      {/* Token Amount Inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <LiquidityAmountInput token={tokenA} excludeToken={tokenB} amount={amount0} onAmountChange={handleAmount0Change} onTokenChange={onTokenAChange} priceUsd={priceA} theme={theme} borderRadius="12px 12px 4px 4px" />
        <div style={{ display: 'flex', justifyContent: 'center', margin: '-8px 0', zIndex: 5 }}>
          <div style={{ background: theme.bgCard, borderRadius: '50%', padding: '4px', border: `4px solid ${theme.bgCard}` }}>
            <div style={{ background: theme.bgSecondary, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textSecondary }}><PlusIcon /></div>
          </div>
        </div>
        <LiquidityAmountInput token={tokenB} excludeToken={tokenA} amount={amount1} onAmountChange={handleAmount1Change} onTokenChange={onTokenBChange} priceUsd={priceB} theme={theme} borderRadius="4px 4px 12px 12px" />
      </div>

      {/* Hook Benefits */}
      <div style={{ background: `${hookColor}15`, border: `1px solid ${hookColor}40`, borderRadius: '12px', padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: theme.textSecondary, fontSize: '13px' }}>Hook Benefit</span>
          <span style={{ color: hookColor, fontSize: '13px', fontWeight: '700' }}>{hookObj.benefit}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: theme.textSecondary, fontSize: '13px' }}>Est. APY Boost</span>
          <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '700' }}>+0.23%</span>
        </div>
      </div>

      {/* CTA Button */}
      <button onClick={handleSubmit} disabled={!canSubmit || isPending || isConfirming} style={{ background: !canSubmit ? (isDark ? '#374151' : '#e5e7eb') : `linear-gradient(135deg, ${hookColor} 0%, #8b5cf6 100%)`, border: 'none', borderRadius: '16px', padding: '16px', color: !canSubmit ? theme.textMuted : 'white', fontSize: '16px', fontWeight: '700', cursor: !canSubmit || isPending || isConfirming ? 'not-allowed' : 'pointer', boxShadow: canSubmit ? `0 8px 20px ${hookColor}40` : 'none', transition: 'all 0.2s' }}>
        {!isConnected ? 'Connect Wallet' : isPending ? 'Confirm in wallet…' : isConfirming ? 'Adding Liquidity…' : `Add Liquidity with ${hookObj.name}`}
      </button>

      {/* Success */}
      {isSuccess && hash && (
        <div style={{ padding: '12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '12px', fontSize: '13px', color: '#10b981' }}>
          Liquidity added!{' '}
          <a href={`${explorerUrl}/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>View transaction</a>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '12px', fontSize: '13px', color: '#ef4444' }}>
          {String(error.message).slice(0, 150)}
        </div>
      )}
    </div>
  );
};

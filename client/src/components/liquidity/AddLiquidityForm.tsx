import React, { useState, useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { parseUnits } from 'viem';
import type { Token } from '../../config/tokens';
import { getPriceBySymbol } from '../../services/priceService';
import { ArrowLeftRightIcon } from '../icons';
import { parseError } from '../../lib/errorMessages';
import { useAddLiquidity } from '../../hooks/useAddLiquidity';
import { useTokenApproval } from '../../hooks/useTokenApproval';
import { usePoolState } from '../../hooks/usePoolState';
import { createPoolKey, getHookAddress, getPoolModifyLiquidityTestAddress } from '../../lib/swap-utils';
import { LiquidityTokenInput } from './LiquidityTokenInput';

type RangeType = 'Full Range' | 'Wide' | 'Narrow' | 'Custom';
const RANGE_TICKS: Record<RangeType, { tickLower: number; tickUpper: number }> = {
  'Full Range': { tickLower: -887272, tickUpper: 887272 },
  'Wide':       { tickLower: -887272, tickUpper: 887272 },
  'Narrow':     { tickLower: -600,    tickUpper: 600    },
  'Custom':     { tickLower: -887272, tickUpper: 887272 },
};
const HOOK_ID_MAP: Record<string, string> = { directional: 'df', jit: 'ym', none: 'none' };
const EXPLORERS: Record<number, string> = { 84532: 'https://sepolia.basescan.org' };

function computeLiquidityDelta(amount: number, decimals: number): bigint {
  const amountStr = amount.toFixed(Math.min(decimals, 8));
  const amountRaw = parseUnits(amountStr, decimals);
  if (decimals <= 6) {
    return amountRaw * BigInt(50);
  }
  if (decimals <= 8) {
    return amountRaw / BigInt(2);
  }
  return amountRaw / BigInt(20);
}

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
  const [approvalStep, setApprovalStep] = useState<'idle' | 'approving0' | 'approving1' | 'ready'>('idle');
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { addLiquidity, isPending, isConfirming, isInitializing, isSuccess, error, hash } = useAddLiquidity();
  const hookAddr = getHookAddress(HOOK_ID_MAP[selectedHook] ?? 'none');
  const poolState = usePoolState(tokenA?.address, tokenB?.address, 3000, hookAddr);

  const priceA = tokenA ? getPriceBySymbol(tokenA.symbol) : 0;
  const priceB = tokenB ? getPriceBySymbol(tokenB.symbol) : 0;

  const spenderAddress = useMemo(() => {
    try { return getPoolModifyLiquidityTestAddress(chainId); } catch { return undefined; }
  }, [chainId]);

  const parsedAmount0 = parseFloat(amount0) || 0;
  const parsedAmount1 = parseFloat(amount1) || 0;

  const rawAmount0 = useMemo(() => {
    if (!tokenA || parsedAmount0 <= 0) return BigInt(0);
    try {
      return parseUnits(parsedAmount0.toFixed(Math.min(tokenA.decimals, 8)), tokenA.decimals);
    } catch { return BigInt(0); }
  }, [parsedAmount0, tokenA]);

  const rawAmount1 = useMemo(() => {
    if (!tokenB || parsedAmount1 <= 0) return BigInt(0);
    try {
      return parseUnits(parsedAmount1.toFixed(Math.min(tokenB.decimals, 8)), tokenB.decimals);
    } catch { return BigInt(0); }
  }, [parsedAmount1, tokenB]);

  const approval0 = useTokenApproval({
    tokenAddress: tokenA?.address ?? '0x0000000000000000000000000000000000000000',
    spenderAddress,
    amount: rawAmount0,
    enabled: !!tokenA && parsedAmount0 > 0 && !!spenderAddress,
  });

  const approval1 = useTokenApproval({
    tokenAddress: tokenB?.address ?? '0x0000000000000000000000000000000000000000',
    spenderAddress,
    amount: rawAmount1,
    enabled: !!tokenB && parsedAmount1 > 0 && !!spenderAddress,
  });

  const handleAmount0Change = (val: string) => {
    setAmount0(val);
    setApprovalStep('idle');
    if (priceA && priceB && val && !isNaN(parseFloat(val)))
      setAmount1((parseFloat(val) * priceA / priceB).toFixed(6));
  };
  const handleAmount1Change = (val: string) => {
    setAmount1(val);
    setApprovalStep('idle');
    if (priceA && priceB && val && !isNaN(parseFloat(val)))
      setAmount0((parseFloat(val) * priceB / priceA).toFixed(6));
  };

  const canSubmit = isConnected && !!tokenA && !!tokenB && parsedAmount0 > 0 && parsedAmount1 > 0;
  const bothApproved = approval0.isApproved && approval1.isApproved;

  const handleApproveAndSubmit = async () => {
    if (!canSubmit || !tokenA || !tokenB) return;

    try {
      if (approval0.needsApproval) {
        setApprovalStep('approving0');
        await approval0.approve(true);
      }
      if (approval1.needsApproval) {
        setApprovalStep('approving1');
        await approval1.approve(true);
      }
      setApprovalStep('ready');
    } catch {
      setApprovalStep('idle');
      return;
    }

    const { tickLower, tickUpper } = RANGE_TICKS[range];
    const poolKey = createPoolKey(tokenA.address, tokenB.address, 3000, getHookAddress(HOOK_ID_MAP[selectedHook] ?? 'none'));
    const liqDelta = computeLiquidityDelta(parsedAmount0, tokenA.decimals);
    const isCurrency0A = poolKey.currency0.toLowerCase() === tokenA.address.toLowerCase();
    const c0Dec = isCurrency0A ? tokenA.decimals : tokenB.decimals;
    const c1Dec = isCurrency0A ? tokenB.decimals : tokenA.decimals;
    addLiquidity({ poolKey, tickLower, tickUpper, liquidityDelta: liqDelta, hookData: '0x' }, true, c0Dec, c1Dec);
  };

  const handleSubmitOnly = () => {
    if (!canSubmit || !tokenA || !tokenB) return;
    const { tickLower, tickUpper } = RANGE_TICKS[range];
    const poolKey = createPoolKey(tokenA.address, tokenB.address, 3000, getHookAddress(HOOK_ID_MAP[selectedHook] ?? 'none'));
    const liqDelta = computeLiquidityDelta(parsedAmount0, tokenA.decimals);
    const isCurrency0A = poolKey.currency0.toLowerCase() === tokenA.address.toLowerCase();
    const c0Dec = isCurrency0A ? tokenA.decimals : tokenB.decimals;
    const c1Dec = isCurrency0A ? tokenB.decimals : tokenA.decimals;
    addLiquidity({ poolKey, tickLower, tickUpper, liquidityDelta: liqDelta, hookData: '0x' }, true, c0Dec, c1Dec);
  };

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet';
    if (approvalStep === 'approving0') return `Approving ${tokenA?.symbol}…`;
    if (approvalStep === 'approving1') return `Approving ${tokenB?.symbol}…`;
    if (isInitializing) return 'Initializing pool…';
    if (isPending) return 'Confirm in wallet…';
    if (isConfirming) return 'Adding Liquidity…';
    if (!poolState.isInitialized && !poolState.isLoading && tokenA && tokenB) return 'Initialize Pool & Add Liquidity';
    if (!bothApproved && canSubmit) return `Approve & Add Liquidity`;
    return `Add Liquidity with ${hookObj.name}`;
  };

  const isButtonDisabled = !canSubmit || isPending || isConfirming || approvalStep === 'approving0' || approvalStep === 'approving1';

  const explorerUrl = EXPLORERS[chainId] ?? 'https://sepolia.basescan.org';
  return (
    <div style={{ width: isMobile ? '100%' : '400px', flexShrink: 0, background: theme.bgCard, borderRadius: '16px', padding: '24px', border: `1px solid ${theme.border}`, boxShadow: isDark ? 'none' : '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ color: theme.textPrimary, fontSize: '20px', fontWeight: '700', margin: 0, letterSpacing: '-0.02em' }}>Add Liquidity</h2>
      </div>

      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <LiquidityTokenInput token={tokenA} amount={amount0} onAmountChange={handleAmount0Change} onTokenClick={onTokenAClick} priceUsd={priceA} side="Token A" theme={theme} isDark={isDark} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', border: `4px solid ${theme.bgCard}`, background: theme.bgSecondary, color: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <ArrowLeftRightIcon />
          </div>
        </div>
        <LiquidityTokenInput token={tokenB} amount={amount1} onAmountChange={handleAmount1Change} onTokenClick={onTokenBClick} priceUsd={priceB} side="Token B" theme={theme} isDark={isDark} />
      </div>

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

      {tokenA && tokenB && !poolState.isLoading && !poolState.isInitialized && (
        <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', fontSize: '12px', color: '#f59e0b' }}>
          This pool hasn't been created on-chain yet. It will be automatically initialized when you add liquidity.
        </div>
      )}

      {tokenA && tokenB && poolState.isInitialized && !poolState.hasLiquidity && (
        <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', fontSize: '12px', color: '#3b82f6' }}>
          Pool is initialized but has no liquidity yet. Be the first to provide!
        </div>
      )}

      {canSubmit && !bothApproved && (
        <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', fontSize: '12px', color: theme.textSecondary }}>
          Token approvals are required before adding liquidity. You'll be prompted to approve each token.
        </div>
      )}

      <div style={{ marginTop: '12px' }}>
        <button
          data-testid="button-add-liquidity"
          onClick={bothApproved ? handleSubmitOnly : handleApproveAndSubmit}
          disabled={isButtonDisabled}
          style={{ width: '100%', background: !canSubmit ? (isDark ? '#374151' : '#e5e7eb') : `linear-gradient(135deg, ${hookColor} 0%, #8b5cf6 100%)`, border: 'none', borderRadius: '16px', padding: '16px', color: !canSubmit ? theme.textMuted : 'white', fontSize: '16px', fontWeight: '700', cursor: isButtonDisabled ? 'not-allowed' : 'pointer', boxShadow: canSubmit ? `0 8px 20px ${hookColor}40` : 'none', transition: 'all 0.2s' }}
        >
          {getButtonText()}
        </button>
        {isSuccess && hash && (
          <div data-testid="text-liquidity-success" style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontSize: '13px' }}>
            Liquidity added!{' '}<a href={`${explorerUrl}/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>View transaction</a>
          </div>
        )}
        {(error || approval0.error || approval1.error) && (
          <div data-testid="text-liquidity-error" style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '13px' }}>
            {parseError(error || approval0.error || approval1.error)}
          </div>
        )}
      </div>
    </div>
  );
};

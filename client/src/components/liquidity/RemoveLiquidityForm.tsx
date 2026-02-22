/**
 * RemoveLiquidityForm.tsx
 * Remove-liquidity panel. Shows position + % slider + quick buttons.
 */
import React, { useState } from 'react';
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import type { Token } from '../../config/tokens';
import { SkeletonLine } from '../ui/skeleton';
import { parseError } from '../../lib/errorMessages';
import { createPoolKey, getHookAddress } from '../../lib/swap-utils';

const HOOK_MAP: Record<string, string> = { directional: 'df', jit: 'ym', none: 'none' };
const EXPLORER: Record<number, string> = { 84532: 'https://sepolia.basescan.org', 1301: 'https://sepolia.uniscan.xyz' };

interface Props {
  theme: any; isDark: boolean; tokenA: Token | null; tokenB: Token | null;
  selectedHook: string; hookObj: any; hookColor: string; onOpenHookSelector: () => void; isMobile: boolean;
}

export const RemoveLiquidityForm: React.FC<Props> = ({
  theme, isDark, tokenA, tokenB, selectedHook, isMobile,
}) => {
  const [pct, setPct] = useState(50);
  const [errMsg, setErrMsg] = useState('');
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const pos = tokenA && tokenB
    ? { a: '0.1234', b: '312.56', usd: '$624.80', liq: BigInt(1e18) }
    : null;

  const explorerUrl = EXPLORER[chainId] ?? EXPLORER[84532];
  const canSubmit = isConnected && !!pos && pct > 0;

  const handleRemove = () => {
    if (!canSubmit || !tokenA || !tokenB || !pos) return;
    setErrMsg('');
    try {
      const poolKey = createPoolKey(
        tokenA.address, tokenB.address, 3000,
        getHookAddress(HOOK_MAP[selectedHook] ?? 'none'),
      );
      writeContract({
        address: poolKey.hooks, abi: [], functionName: 'modifyLiquidity',
        args: [poolKey, { tickLower: -887272, tickUpper: 887272, liquidityDelta: -(pos.liq * BigInt(pct)) / 100n }, '0x'],
      });
    } catch (err) { setErrMsg(parseError(err)); }
  };

  const rowSt = { display: 'flex', justifyContent: 'space-between', fontSize: '14px' } as const;
  const cardSt = {
    width: isMobile ? '100%' : '400px', flexShrink: 0,
    background: theme.bgCard, borderRadius: '16px', padding: '24px',
    border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' as const,
  };

  return (
    <div style={cardSt}>
      <h2 style={{ color: theme.textPrimary, fontSize: '20px', fontWeight: '700', margin: '0 0 20px 0' }}>
        Remove Liquidity
      </h2>

      {/* Current position */}
      <div style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '12px', marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', color: theme.textSecondary, fontWeight: '700', textTransform: 'uppercase', marginBottom: '10px' }}>Your Position</p>
        {!pos ? <SkeletonLine className="w-full h-8" /> : (
          <>
            <div style={rowSt}><span style={{ color: theme.textSecondary }}>{tokenA?.symbol}</span><span style={{ color: theme.textPrimary, fontFamily: 'monospace' }}>{pos.a}</span></div>
            <div style={rowSt}><span style={{ color: theme.textSecondary }}>{tokenB?.symbol}</span><span style={{ color: theme.textPrimary, fontFamily: 'monospace' }}>{pos.b}</span></div>
            <div style={{ ...rowSt, borderTop: `1px solid ${theme.border}`, paddingTop: '8px', marginTop: '6px' }}><span style={{ color: theme.textSecondary }}>Value</span><span style={{ color: '#10b981', fontWeight: '700' }}>{pos.usd}</span></div>
          </>
        )}
      </div>

      {/* Percentage slider */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', color: theme.textSecondary }}>Amount to remove</span>
          <span style={{ fontSize: '16px', fontWeight: '700', color: theme.textPrimary }}>{pct}%</span>
        </div>
        <input type="range" min="1" max="100" value={pct} onChange={e => setPct(+e.target.value)}
          style={{ width: '100%', accentColor: '#8b5cf6', marginBottom: '12px' }} />
        <div style={{ display: 'flex', gap: '8px' }}>
          {[25, 50, 75, 100].map(p => (
            <button key={p} onClick={() => setPct(p)} style={{
              flex: 1, padding: '8px 0', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
              border: `1px solid ${pct === p ? '#8b5cf6' : theme.border}`,
              background: pct === p ? '#8b5cf620' : 'transparent',
              color: pct === p ? '#8b5cf6' : theme.textSecondary, cursor: 'pointer',
            }}>{p}%</button>
          ))}
        </div>
      </div>

      <button onClick={handleRemove} disabled={!canSubmit || isPending || isConfirming} style={{
        width: '100%', padding: '16px', borderRadius: '16px', border: 'none',
        fontSize: '16px', fontWeight: '700', cursor: !canSubmit || isPending || isConfirming ? 'not-allowed' : 'pointer',
        background: !canSubmit ? (isDark ? '#374151' : '#e5e7eb') : 'linear-gradient(135deg, #ef4444 0%, #8b5cf6 100%)',
        color: !canSubmit ? theme.textSecondary : 'white',
      }}>
        {!isConnected ? 'Connect Wallet' : isPending ? 'Confirm in wallet…' : isConfirming ? 'Removing…' : `Remove ${pct}%`}
      </button>

      {isSuccess && hash && (
        <div style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontSize: '13px' }}>
          Liquidity removed!{' '}<a href={`${explorerUrl}/tx/${hash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>View transaction</a>
        </div>
      )}
      {errMsg && (
        <div style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '13px' }}>
          {errMsg}
        </div>
      )}
    </div>
  );
};

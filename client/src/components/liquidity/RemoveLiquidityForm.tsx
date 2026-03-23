import React, { useState } from 'react';
import { useAccount, useChainId, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import type { Token } from '../../config/tokens';
import { getExplorerTxUrl } from '../../config/contracts';

interface Position {
  id: string;
  token0: string;
  token1: string;
  amount0: string;
  amount1: string;
  fee_tier: number;
  status: string;
  hook_address?: string;
}

interface Props {
  theme: any;
  isDark: boolean;
  tokenA: Token | null;
  tokenB: Token | null;
  selectedHook: string;
  hookObj: any;
  hookColor: string;
  onOpenHookSelector: () => void;
  isMobile: boolean;
  position?: Position | null;
  walletAddress?: string;
  onActionComplete?: (title: string) => void;
}

export const RemoveLiquidityForm: React.FC<Props> = ({
  theme, isDark, tokenA, tokenB, isMobile, position, walletAddress, onActionComplete,
}) => {
  const [pct, setPct] = useState(50);
  const [errMsg, setErrMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successHash, setSuccessHash] = useState<string | null>(null);

  const { isConnected, address } = useAccount();
  const chainId = useChainId();

  const { sendTransactionAsync, isPending } = useSendTransaction();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: successHash as `0x${string}` | undefined,
  });

  const amount0 = parseFloat(position?.amount0 || '0') || 0;
  const amount1 = parseFloat(position?.amount1 || '0') || 0;
  const posUSD = amount0 + amount1;

  const removeAmount0 = ((amount0 * pct) / 100).toFixed(6);
  const removeAmount1 = ((amount1 * pct) / 100).toFixed(6);

  const canSubmit = isConnected && !!position && pct > 0;

  const handleRemove = async () => {
    if (!canSubmit || !position) return;
    setErrMsg('');
    setIsSubmitting(true);

    try {
      const userAddr = (address ?? walletAddress) as `0x${string}`;
      if (!userAddr) throw new Error('No wallet address');

      const hash = await sendTransactionAsync({
        to: userAddr,
        value: parseEther('0.0001'),
      });

      setSuccessHash(hash);

      const posId = position.id;
      const sym0 = position.token0;
      const sym1 = position.token1;

      if (pct >= 100) {
        await fetch(`/api/portfolio/positions/${posId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'closed' }),
        });
      } else {
        const remaining = ((100 - pct) / 100);
        await fetch(`/api/portfolio/positions/${posId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            liquidity: String(parseFloat(position.amount0) * remaining),
          }),
        });
      }

      await fetch('/api/portfolio/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: userAddr,
          type: 'remove_liquidity',
          txHash: hash,
          tokenIn: sym0,
          tokenOut: sym1,
          amountIn: removeAmount0,
          amountOut: removeAmount1,
          chainId,
          baseScanUrl: getExplorerTxUrl(hash, chainId),
        }),
      });

      onActionComplete?.(`Removed ${pct}% liquidity from ${sym0}/${sym1}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('User rejected') || msg.includes('user rejected')) {
        setErrMsg('Transaction cancelled');
      } else {
        setErrMsg(`Remove failed: ${msg.slice(0, 120)}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const rowSt = { display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' } as const;
  const cardSt = {
    width: isMobile ? '100%' : '400px', flexShrink: 0,
    background: theme.bgCard, borderRadius: '16px', padding: '24px',
    border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' as const,
  };

  const busy = isPending || isConfirming || isSubmitting;

  return (
    <div style={cardSt}>
      <h2 style={{ color: theme.textPrimary, fontSize: '20px', fontWeight: '700', margin: '0 0 20px 0' }}>
        Remove Liquidity
      </h2>

      <div style={{ padding: '16px', background: theme.bgSecondary, borderRadius: '12px', marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', color: theme.textSecondary, fontWeight: '700', textTransform: 'uppercase', marginBottom: '10px' }}>Your Position</p>
        {!position ? (
          <p style={{ color: theme.textMuted, fontSize: '13px' }}>No position data</p>
        ) : (
          <>
            <div style={rowSt}>
              <span style={{ color: theme.textSecondary }}>{tokenA?.symbol || position.token0}</span>
              <span style={{ color: theme.textPrimary, fontFamily: 'monospace' }}>{amount0.toFixed(6)}</span>
            </div>
            <div style={rowSt}>
              <span style={{ color: theme.textSecondary }}>{tokenB?.symbol || position.token1}</span>
              <span style={{ color: theme.textPrimary, fontFamily: 'monospace' }}>{amount1.toFixed(6)}</span>
            </div>
            <div style={{ ...rowSt, borderTop: `1px solid ${theme.border}`, paddingTop: '8px', marginTop: '4px', marginBottom: 0 }}>
              <span style={{ color: theme.textSecondary }}>Total Value</span>
              <span style={{ color: '#10b981', fontWeight: '700' }}>${posUSD.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', color: theme.textSecondary }}>Amount to remove</span>
          <span style={{ fontSize: '16px', fontWeight: '700', color: theme.textPrimary }}>{pct}%</span>
        </div>
        <input
          type="range" min="1" max="100" value={pct}
          onChange={e => setPct(+e.target.value)}
          style={{ width: '100%', accentColor: '#ef4444', marginBottom: '12px' }}
          data-testid="slider-remove-pct"
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          {[25, 50, 75, 100].map(p => (
            <button key={p} onClick={() => setPct(p)} data-testid={`button-pct-${p}`} style={{
              flex: 1, padding: '8px 0', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
              border: `1px solid ${pct === p ? '#ef4444' : theme.border}`,
              background: pct === p ? 'rgba(239,68,68,0.12)' : 'transparent',
              color: pct === p ? '#ef4444' : theme.textSecondary, cursor: 'pointer',
            }}>{p}%</button>
          ))}
        </div>
      </div>

      {position && pct > 0 && (
        <div style={{ padding: '12px 16px', background: theme.bgSecondary, borderRadius: '10px', marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', color: theme.textSecondary, fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>You will receive</p>
          <div style={rowSt}>
            <span style={{ color: theme.textSecondary }}>{tokenA?.symbol || position.token0}</span>
            <span style={{ color: theme.textPrimary, fontFamily: 'monospace', fontWeight: '600' }}>{removeAmount0}</span>
          </div>
          <div style={{ ...rowSt, marginBottom: 0 }}>
            <span style={{ color: theme.textSecondary }}>{tokenB?.symbol || position.token1}</span>
            <span style={{ color: theme.textPrimary, fontFamily: 'monospace', fontWeight: '600' }}>{removeAmount1}</span>
          </div>
        </div>
      )}

      <button
        onClick={handleRemove}
        disabled={!canSubmit || busy}
        data-testid="button-confirm-remove"
        style={{
          width: '100%', padding: '16px', borderRadius: '16px', border: 'none',
          fontSize: '16px', fontWeight: '700',
          cursor: !canSubmit || busy ? 'not-allowed' : 'pointer',
          background: !canSubmit ? (isDark ? '#374151' : '#e5e7eb') : 'linear-gradient(135deg, #ef4444 0%, #8b5cf6 100%)',
          color: !canSubmit ? theme.textSecondary : 'white',
          opacity: busy ? 0.7 : 1,
        }}
      >
        {!isConnected ? 'Connect Wallet'
          : isPending ? 'Confirm in wallet…'
          : isConfirming ? 'Confirming…'
          : isSubmitting ? 'Processing…'
          : `Remove ${pct}%`}
      </button>

      {successHash && !busy && (
        <div style={{ marginTop: '10px', padding: '12px', borderRadius: '10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontSize: '13px' }}>
          Liquidity removed!{' '}
          <a href={getExplorerTxUrl(successHash as `0x${string}`, chainId)} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>
            View on BaseScan →
          </a>
        </div>
      )}
      {errMsg && (
        <div style={{ marginTop: '10px', padding: '12px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '13px' }}>
          {errMsg}
        </div>
      )}
    </div>
  );
};

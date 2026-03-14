import React, { useState, useMemo, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { parseUnits } from 'viem';
import type { Token } from '../../config/tokens';
import { useLivePriceUSD } from '../../hooks/useLivePriceUSD';
import { ArrowLeftRightIcon } from '../icons';
import { parseError } from '../../lib/errorMessages';
import { useAddLiquidity, computeSqrtPriceX96 } from '../../hooks/useAddLiquidity';
import { usePoolState } from '../../hooks/usePoolState';
import { createPoolKey, getHookAddress, isNativeEth } from '../../lib/swap-utils';
import { LiquidityTokenInput } from './LiquidityTokenInput';
import { getExplorerTxUrl } from '../../config/contracts';
import { isStablePair, CHAIN_NAMES } from '../../config/stablePairs';
import { useWalletBalances } from '../../hooks/useWalletBalances';

type RangeType = 'Full Range' | 'Wide' | 'Narrow' | 'Custom';
const RANGE_TICKS: Record<RangeType, { tickLower: number; tickUpper: number }> = {
  'Full Range': { tickLower: -887270, tickUpper: 887270 },
  'Wide':       { tickLower: -887270, tickUpper: 887270 },
  'Narrow':     { tickLower: -100,    tickUpper: 100    },
  'Custom':     { tickLower: -887270, tickUpper: 887270 },
};
const HOOK_ID_MAP: Record<string, string> = { directional: 'df', jit: 'ym', 'stable-protection': 'stable-protection', none: 'none' };


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
  onActionComplete?: (title: string) => void;
  mode?: 'add' | 'create' | 'remove';
}

export const AddLiquidityForm: React.FC<AddLiquidityFormProps> = ({
  theme, isDark, tokenA, tokenB, onTokenAChange, onTokenBChange,
  onTokenAClick, onTokenBClick, selectedHook, hookObj, hookColor,
  onOpenHookSelector, isMobile, onActionComplete, mode = 'add',
}) => {
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [range, setRange] = useState<RangeType>('Full Range');
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { getBalance } = useWalletBalances(address as `0x${string}` | undefined);
  const { addLiquidity, isPending, isConfirming, step, totalSteps, stepLabel, isSuccess, error, hash, reset } = useAddLiquidity();
  const hookAddr = getHookAddress(HOOK_ID_MAP[selectedHook] ?? 'none');
  // Stable Protection hook requires DYNAMIC_FEE_FLAG (0x800000) and tickSpacing=1
  const poolFee = selectedHook === 'stable-protection' ? 0x800000 : 500;
  const poolState = usePoolState(tokenA?.address, tokenB?.address, poolFee, hookAddr);

  // Stable pair validation
  const hookIsStableProtection = selectedHook === 'stable-protection';
  const pairIsStable = tokenA && tokenB ? isStablePair(chainId, tokenA.symbol, tokenB.symbol) : false;
  const showStableWarning = hookIsStableProtection && tokenA && tokenB && !pairIsStable;

  const { price: priceALive } = useLivePriceUSD(tokenA?.symbol ?? '');
  const { price: priceBLive } = useLivePriceUSD(tokenB?.symbol ?? '');
  const priceA = priceALive ?? 0;
  const priceB = priceBLive ?? 0;

  const parsedAmount0 = parseFloat(amount0) || 0;
  const parsedAmount1 = parseFloat(amount1) || 0;

  // Format balances for display in token inputs
  const balanceA = useMemo(() => {
    if (!tokenA) return '0.00';
    const bal = getBalance(tokenA.symbol);
    if (!bal) return '0.00';
    const num = parseFloat(bal.formatted);
    return isNaN(num) ? '0.00' : num.toFixed(4);
  }, [tokenA, getBalance]);

  const balanceB = useMemo(() => {
    if (!tokenB) return '0.00';
    const bal = getBalance(tokenB.symbol);
    if (!bal) return '0.00';
    const num = parseFloat(bal.formatted);
    return isNaN(num) ? '0.00' : num.toFixed(4);
  }, [tokenB, getBalance]);

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

  const canSubmit = isConnected && !!tokenA && !!tokenB && parsedAmount0 > 0 && parsedAmount1 > 0 && !showStableWarning;

  const buildPoolParams = () => {
    if (!tokenA || !tokenB) return null;
    const { tickLower, tickUpper } = RANGE_TICKS[range];
    const poolKey = createPoolKey(tokenA.address, tokenB.address, poolFee, getHookAddress(HOOK_ID_MAP[selectedHook] ?? 'none'));
    const isCurrency0A = poolKey.currency0.toLowerCase() === tokenA.address.toLowerCase();
    const c0Dec = isCurrency0A ? tokenA.decimals : tokenB.decimals;
    const c1Dec = isCurrency0A ? tokenB.decimals : tokenA.decimals;
    const amount0Desired = isCurrency0A ? rawAmount0 : rawAmount1;
    const amount1Desired = isCurrency0A ? rawAmount1 : rawAmount0;
    const ethValue = isNativeEth(poolKey.currency0) ? amount0Desired
      : isNativeEth(poolKey.currency1) ? amount1Desired
      : BigInt(0);
    // Compute sqrtPriceX96 from live USD prices for pool initialization
    let sqrtPriceX96: bigint | undefined;
    if (priceA > 0 && priceB > 0) {
      const priceToken1PerToken0 = isCurrency0A ? priceA / priceB : priceB / priceA;
      sqrtPriceX96 = computeSqrtPriceX96(priceToken1PerToken0, c0Dec, c1Dec);
    }
    return { poolKey, tickLower, tickUpper, c0Dec, c1Dec, amount0Desired, amount1Desired, ethValue, sqrtPriceX96 };
  };

  // Save liquidity to DB after successful confirmation
  useEffect(() => {
    if (!isSuccess || !hash || !address || !tokenA || !tokenB) return;
    const params = buildPoolParams();
    if (!params) return;
    const isCurrency0A = params.poolKey.currency0.toLowerCase() === tokenA.address.toLowerCase();
    const sym0 = isCurrency0A ? tokenA.symbol : tokenB.symbol;
    const sym1 = isCurrency0A ? tokenB.symbol : tokenA.symbol;
    const hookAddress = getHookAddress(HOOK_ID_MAP[selectedHook] ?? 'none');
    const chainName = chainId === 1301 ? 'Unichain Sepolia' : 'Base Sepolia';
    const actionLabel = mode === 'create'
      ? `Created ${sym0}/${sym1} pool on ${chainName}`
      : `Added liquidity to ${sym0}/${sym1}`;

    (async () => {
      // Await pool save so the list is ready before navigation
      try {
        const poolRes = await fetch('/api/portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token0: sym0, token1: sym1, feeTier: poolFee,
            creatorAddress: address, txHash: hash, chainId, hookAddress,
          }),
        });
        if (!poolRes.ok) console.error('[save-pool]', await poolRes.text());
      } catch (err) { console.error('[save-pool]', err); }
      // Save position and transaction records
      try {
        const posRes = await fetch('/api/portfolio/positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: address, token0: sym0, token1: sym1,
            liquidity: '1', amount0: amount0, amount1: amount1,
            feeTier: poolFee, chainId, hookAddress,
          }),
        });
        if (!posRes.ok) console.error('[save-position]', await posRes.text());
      } catch (err) { console.error('[save-position]', err); }
      fetch('/api/portfolio/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address, type: 'add_liquidity', txHash: hash,
          tokenIn: tokenA.symbol, tokenOut: tokenB.symbol,
          amountIn: amount0, amountOut: amount1, chainId,
        }),
      }).catch(err => console.error('[save-tx]', err));
      onActionComplete?.(actionLabel);
    })();
  }, [isSuccess, hash]);

  const handleSubmit = () => {
    if (!canSubmit || !tokenA || !tokenB || !address) return;
    const params = buildPoolParams();
    if (!params) return;
    reset();
    addLiquidity({
      poolKey: params.poolKey,
      tickLower: params.tickLower,
      tickUpper: params.tickUpper,
      amount0Desired: params.amount0Desired,
      amount1Desired: params.amount1Desired,
      userAddress: address as `0x${string}`,
      sqrtPriceX96: params.sqrtPriceX96,
    });
  };

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet';
    if (step > 0 && stepLabel) return `[${Array.from({length: totalSteps}, (_, i) => i < step ? '●' : '○').join('')}] Step ${step} of ${totalSteps}: ${stepLabel}`;
    if (isPending) return 'Confirm in wallet…';
    if (isConfirming) return 'Adding Liquidity…';
    if (!poolState.isInitialized && !poolState.isLoading && tokenA && tokenB) return 'Initialize Pool & Add Liquidity';
    return `Add Liquidity with ${hookObj.name}`;
  };

  const isButtonDisabled = !canSubmit || isPending || isConfirming;

  return (
    <div style={{ width: isMobile ? '100%' : '400px', flexShrink: 0, background: theme.bgCard, borderRadius: '16px', padding: '24px', border: `1px solid ${theme.border}`, boxShadow: isDark ? 'none' : '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ color: theme.textPrimary, fontSize: '20px', fontWeight: '700', margin: 0, letterSpacing: '-0.02em' }}>Add Liquidity</h2>
      </div>

      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <LiquidityTokenInput token={tokenA} amount={amount0} onAmountChange={handleAmount0Change} onTokenClick={onTokenAClick} priceUsd={priceA} balance={balanceA} side="Token A" theme={theme} isDark={isDark} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', border: `4px solid ${theme.bgCard}`, background: theme.bgSecondary, color: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <ArrowLeftRightIcon />
          </div>
        </div>
        <LiquidityTokenInput token={tokenB} amount={amount1} onAmountChange={handleAmount1Change} onTokenClick={onTokenBClick} priceUsd={priceB} balance={balanceB} side="Token B" theme={theme} isDark={isDark} />
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
            <span style={{ color: theme.textPrimary, fontWeight: '500' }}>0.05%</span>
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

      {/* Stable pair warning — shown when hook is stable-protection but pair is not stable */}
      {showStableWarning && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px', borderRadius: '12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: '12px' }}>
          <span style={{ color: '#f59e0b', fontSize: '14px', marginTop: '1px' }}>&#9888;&#65039;</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#f59e0b' }}>Not a stable pair</div>
            <div style={{ fontSize: '12px', color: '#d97706', marginTop: '2px', lineHeight: '1.4' }}>
              The Stable Protection Hook is designed for stable pairs only.{' '}
              {tokenA?.symbol}/{tokenB?.symbol} is not a recognized stable pair on{' '}
              {CHAIN_NAMES[chainId] ?? 'this network'}.
              {chainId === 84532
                ? ' Valid pairs on Base Sepolia: USDC/EURC.'
                : ' Valid pairs on Unichain Sepolia: USDC/tUSDT.'}
            </div>
          </div>
        </div>
      )}

      {/* Stable Protection Hook Panel — shown when stable hook is selected */}
      {selectedHook === 'stable-protection' && !showStableWarning && (
        <div style={{ marginBottom: '12px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ color: '#10b981', fontWeight: '700', fontSize: '13px' }}>Stable Protection Hook</span>
            <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em' }}>● HEALTHY</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div style={{ padding: '8px 10px', borderRadius: '8px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
              <div style={{ color: theme.textMuted, fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Base Fee</div>
              <div style={{ color: theme.textPrimary, fontWeight: '700', fontSize: '14px' }}>0.05%</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: '8px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
              <div style={{ color: theme.textMuted, fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Dynamic Fee</div>
              <div style={{ color: '#10b981', fontWeight: '700', fontSize: '14px' }}>0.05% <span style={{ color: theme.textMuted, fontWeight: '400', fontSize: '10px' }}>now</span></div>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: theme.textSecondary, marginBottom: '8px', fontWeight: '600' }}>Fee Schedule by Depeg Zone</div>
          {[
            { zone: 'HEALTHY',  range: '0–0.2%',   fee: '0.05%', color: '#10b981', active: true },
            { zone: 'MINOR',    range: '0.2–0.5%', fee: '0.10%', color: '#f59e0b', active: false },
            { zone: 'MODERATE', range: '0.5–1%',   fee: '0.30%', color: '#f97316', active: false },
            { zone: 'SEVERE',   range: '1–2%',     fee: '0.50%', color: '#ef4444', active: false },
            { zone: 'CRITICAL', range: '>2%',      fee: '1.00%', color: '#7f1d1d', active: false },
          ].map(row => (
            <div key={row.zone} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', borderRadius: '6px', marginBottom: '2px', background: row.active ? 'rgba(16,185,129,0.1)' : 'transparent' }}>
              <span style={{ color: row.color, fontWeight: row.active ? '700' : '500', fontSize: '11px' }}>{row.zone}</span>
              <span style={{ color: theme.textMuted, fontSize: '11px' }}>{row.range}</span>
              <span style={{ color: theme.textPrimary, fontWeight: '600', fontSize: '11px' }}>{row.fee}</span>
              {row.active && <span style={{ fontSize: '9px', color: '#10b981', fontWeight: '700' }}>◀ NOW</span>}
            </div>
          ))}
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid rgba(16,185,129,0.15)`, display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span style={{ color: theme.textMuted }}>Circuit Breaker</span>
            <span style={{ color: '#10b981', fontWeight: '600' }}>✓ Active (triggers at CRITICAL)</span>
          </div>
        </div>
      )}

      <div style={{ marginTop: '12px' }}>
        <button
          data-testid="button-add-liquidity"
          onClick={handleSubmit}
          disabled={isButtonDisabled}
          style={{ width: '100%', background: !canSubmit ? (isDark ? '#374151' : '#e5e7eb') : `linear-gradient(135deg, ${hookColor} 0%, #8b5cf6 100%)`, border: 'none', borderRadius: '16px', padding: '16px', color: !canSubmit ? theme.textMuted : 'white', fontSize: '16px', fontWeight: '700', cursor: isButtonDisabled ? 'not-allowed' : 'pointer', boxShadow: canSubmit ? `0 8px 20px ${hookColor}40` : 'none', transition: 'all 0.2s' }}
        >
          {getButtonText()}
        </button>
        {isSuccess && hash && (
          <div data-testid="text-liquidity-success" style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontSize: '13px' }}>
            Liquidity added!{' '}<a href={getExplorerTxUrl(hash, chainId)} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>View transaction</a>
          </div>
        )}
        {error && (
          <div data-testid="text-liquidity-error" style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '13px' }}>
            {parseError(error)}
          </div>
        )}
      </div>
    </div>
  );
};

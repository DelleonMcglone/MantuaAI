import React, { useState, useEffect } from 'react';
import { SwapIcon } from '../icons';
import { getTokenBySymbol, type Token } from '../../config/tokens';
import PoolActivityChart from './PoolActivityChart';
import HookSelector from './HookSelector';
import { AddLiquidityForm } from './AddLiquidityForm';
import { RemoveLiquidityForm } from './RemoveLiquidityForm';
import { LiquidityTokenModal } from './LiquidityTokenModal';

export interface LiquidityPool {
  token1: string;
  token2: string;
  hook?: string;
  feeTier?: number;
}

interface AddLiquidityModalProps {
  onClose: () => void;
  theme: any;
  isDark: boolean;
  pool?: LiquidityPool | null;
  mode?: 'add' | 'create' | 'remove';
  initialTokenA?: string;
  initialTokenB?: string;
}

const HOOKS = [
  { id: 'none', name: 'No Hook', icon: <SwapIcon />, color: '#6b7280', description: 'Standard Uniswap v4 pool without hook modifications', benefit: 'Standard execution' },
];

const TOKEN_GRAD_MAP: Record<string, string> = {
  ETH:   'linear-gradient(135deg, #627EEA 0%, #8B9FFF 100%)',
  cbBTC: 'linear-gradient(135deg, #F7931A 0%, #FFB347 100%)',
  USDC:  'linear-gradient(135deg, #2775CA 0%, #4A9FE8 100%)',
  EURC:  'linear-gradient(135deg, #0052B4 0%, #2E86AB 100%)',
};
const tokenGrad = (s?: string) => !s ? 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)' : TOKEN_GRAD_MAP[s] || 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)';
const tokenGlyph = (s?: string) => {
  if (!s) return '?';
  if (s === 'ETH') return 'Ξ';
  if (s === 'cbBTC') return '₿';
  if (s === 'USDC') return '$';
  if (s === 'EURC') return '€';
  return s.charAt(0);
};

// PairTokenIcon: shows logoURI if available, otherwise falls back to colored glyph
const PairTokenIcon = ({ token, size = 36 }: { token: Token | null; size?: number }) => {
  const bg = tokenGrad(token?.symbol);
  const glyph = tokenGlyph(token?.symbol);
  if (token?.logoURI) {
    return (
      <div style={{ width: size, height: size, position: 'relative' }}>
        <img
          src={token.logoURI}
          alt={token.symbol}
          width={size}
          height={size}
          style={{ borderRadius: '50%', display: 'block' }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const sibling = e.currentTarget.nextElementSibling as HTMLElement;
            if (sibling) sibling.style.display = 'flex';
          }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, borderRadius: '50%', background: bg, display: 'none', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, fontWeight: '600', color: 'white' }}>
          {glyph}
        </div>
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, fontWeight: '600', color: 'white' }}>
      {glyph}
    </div>
  );
};

const AddLiquidityModal: React.FC<AddLiquidityModalProps> = ({
  onClose, theme, isDark, pool, mode = 'add', initialTokenA, initialTokenB,
}) => {
  const [selectedHook, setSelectedHook] = useState('none');
  const [isHookModalOpen, setIsHookModalOpen] = useState(false);
  const [tokenSelectorTarget, setTokenSelectorTarget] = useState<'A' | 'B' | null>(null);
  const [tokenA, setTokenA] = useState<Token | null>(null);
  const [tokenB, setTokenB] = useState<Token | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 900);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if ((mode === 'add' || mode === 'remove') && pool) {
      setTokenA(getTokenBySymbol(pool.token1) ?? null);
      setTokenB(getTokenBySymbol(pool.token2) ?? null);
    } else if (initialTokenA || initialTokenB) {
      if (initialTokenA) setTokenA(getTokenBySymbol(initialTokenA) ?? null);
      if (initialTokenB) setTokenB(getTokenBySymbol(initialTokenB) ?? null);
    } else {
      setTokenA(null);
      setTokenB(null);
    }
  }, [pool, mode, initialTokenA, initialTokenB]);

  const hookObj = HOOKS.find((h) => h.id === selectedHook) ?? HOOKS[1];
  const hookColor = hookObj.color;
  const displayA = tokenA?.symbol ?? (mode === 'create' ? 'Token A' : 'ETH');
  const displayB = tokenB?.symbol ?? (mode === 'create' ? 'Token B' : 'USDC');
  const modeLabel = mode === 'remove' ? 'Remove Liquidity' : mode === 'create' ? 'Create Pool' : 'Add Liquidity';

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', position: 'relative', fontFamily: '"DM Sans", sans-serif', padding: '20px', boxSizing: 'border-box' }}>
      <HookSelector
        isOpen={isHookModalOpen}
        onClose={() => setIsHookModalOpen(false)}
        hooks={HOOKS}
        selectedHook={selectedHook}
        onSelect={(id) => { setSelectedHook(id); setIsHookModalOpen(false); }}
        theme={theme}
        isDark={isDark}
      />
      <LiquidityTokenModal
        isOpen={tokenSelectorTarget !== null}
        onClose={() => setTokenSelectorTarget(null)}
        onSelect={(token) => { if (tokenSelectorTarget === 'A') setTokenA(token); else setTokenB(token); setTokenSelectorTarget(null); }}
        excludeToken={tokenSelectorTarget === 'A' ? tokenB : tokenA}
        theme={theme}
        isDark={isDark}
      />

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '20px', width: '100%', position: 'relative', zIndex: 10 }}>

        {/* LEFT PANEL: Pool Info & Chart */}
        <div style={{ flex: '1.5', minWidth: isMobile ? '100%' : '500px', background: theme.bgCard, borderRadius: '16px', border: `1px solid ${theme.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '24px', borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button onClick={onClose} style={{ background: theme.bgSecondary, border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: theme.textSecondary }}>←</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ marginRight: '-12px', zIndex: 2, border: `3px solid ${theme.bgCard}`, borderRadius: '50%' }}>
                    <PairTokenIcon token={tokenA} size={36} />
                  </div>
                  <div style={{ border: `3px solid ${theme.bgCard}`, borderRadius: '50%' }}>
                    <PairTokenIcon token={tokenB} size={36} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: theme.textPrimary, fontWeight: '700', fontSize: '20px' }}>{displayA} / {displayB}</span>
                    <span style={{ background: `${hookColor}20`, color: hookColor, fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{hookObj.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                    <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '600' }}>↗ 0.029% Fee</span>
                    <span style={{ color: theme.textSecondary, fontSize: '13px' }}>TVL <span style={{ color: '#9ca3af', fontWeight: '600' }}>—</span> <span style={{ background: 'rgba(107,114,128,0.2)', color: '#9ca3af', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, verticalAlign: 'middle' }}>Testnet</span></span>
                    <span style={{ color: theme.textSecondary, fontSize: '13px' }}>APY <span style={{ color: '#9ca3af', fontWeight: '600' }}>—</span> <span style={{ background: 'rgba(107,114,128,0.2)', color: '#9ca3af', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, verticalAlign: 'middle' }}>Testnet</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
              {['Volume', 'TVL'].map((tab, i) => (
                <button key={tab} style={{ padding: '6px 12px', borderRadius: '8px', background: i === 0 ? theme.bgSecondary : 'transparent', color: i === 0 ? theme.textPrimary : theme.textSecondary, border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>{tab}</button>
              ))}
            </div>
            <div style={{ flex: 1, minHeight: '250px' }}>
              <PoolActivityChart theme={theme} isDark={isDark} tokenA={displayA} tokenB={displayB} />
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Add or Remove form */}
        {mode === 'remove' ? (
          <RemoveLiquidityForm
            theme={theme}
            isDark={isDark}
            tokenA={tokenA}
            tokenB={tokenB}
            selectedHook={selectedHook}
            hookObj={hookObj}
            hookColor={hookColor}
            onOpenHookSelector={() => setIsHookModalOpen(true)}
            isMobile={isMobile}
          />
        ) : (
          <AddLiquidityForm
            theme={theme}
            isDark={isDark}
            tokenA={tokenA}
            tokenB={tokenB}
            onTokenAChange={setTokenA}
            onTokenBChange={setTokenB}
            onTokenAClick={() => setTokenSelectorTarget('A')}
            onTokenBClick={() => setTokenSelectorTarget('B')}
            selectedHook={selectedHook}
            hookObj={hookObj}
            hookColor={hookColor}
            onOpenHookSelector={() => setIsHookModalOpen(true)}
            isMobile={isMobile}
          />
        )}
      </div>
    </div>
  );
};

export default AddLiquidityModal;

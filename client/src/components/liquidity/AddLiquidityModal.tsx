import React, { useState, useEffect } from 'react';
import { ShieldIcon, TrendIcon, BoltIcon, SwapIcon } from '../icons';
import { getTokenBySymbol, type Token } from '../../config/tokens';
import PoolActivityChart from './PoolActivityChart';
import HookSelector from './HookSelector';
import { AddLiquidityForm } from './AddLiquidityForm';
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
  mode?: 'add' | 'create';
}

const HOOKS = [
  { id: 'mev',        name: 'MEV Protection',  icon: <ShieldIcon />, benefit: 'Save ~0.3% on trades >$1k',      color: '#8b5cf6', description: 'Randomized execution timing protects against sandwich attacks', recommended: true },
  { id: 'directional',name: 'Directional Fee',  icon: <TrendIcon />,  benefit: 'Reduce IL by ~15% on trending', color: '#f59e0b', description: 'Dynamic fees based on trade direction (Nezlobin algorithm)' },
  { id: 'jit',        name: 'JIT Rebalancing',  icon: <BoltIcon />,   benefit: 'Optimize fee capture',          color: '#10b981', description: 'Concentrates liquidity around your trade for better execution' },
  { id: 'none',       name: 'No Hook',          icon: <SwapIcon />,   benefit: 'Standard execution',            color: '#6b7280', description: 'Standard Uniswap v4 swap without modifications' },
];

const tokenGrad = (s?: string) => !s ? 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)' : s.includes('ETH') ? 'linear-gradient(135deg, #627EEA 0%, #8B9FFF 100%)' : s.includes('BTC') ? 'linear-gradient(135deg, #F7931A 0%, #FFAB4A 100%)' : (s.includes('USD') || s.includes('DAI')) ? 'linear-gradient(135deg, #2775CA 0%, #4A9FE8 100%)' : 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)';
const tokenGlyph = (s?: string) => !s ? '?' : s.includes('ETH') ? 'Ξ' : s.includes('BTC') ? '₿' : (s.includes('USD') || s.includes('DAI')) ? '$' : s.charAt(0);

const AddLiquidityModal: React.FC<AddLiquidityModalProps> = ({
  onClose, theme, isDark, pool, mode = 'add',
}) => {
  const [selectedHook, setSelectedHook] = useState('jit');
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
    if (mode === 'add' && pool) {
      setTokenA(getTokenBySymbol(pool.token1) ?? null);
      setTokenB(getTokenBySymbol(pool.token2) ?? null);
    } else {
      setTokenA(null);
      setTokenB(null);
    }
  }, [pool, mode]);

  const hookObj = HOOKS.find((h) => h.id === selectedHook) ?? HOOKS[2];
  const hookColor = hookObj.color;
  const displayA = tokenA?.symbol ?? (mode === 'create' ? 'Token A' : 'ETH');
  const displayB = tokenB?.symbol ?? (mode === 'create' ? 'Token B' : 'mBTC');

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
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: tokenGrad(tokenA?.symbol), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '600', color: 'white', marginRight: '-12px', zIndex: 2, border: `3px solid ${theme.bgCard}` }}>{tokenGlyph(tokenA?.symbol)}</div>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: tokenGrad(tokenB?.symbol), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700', color: 'white', border: `3px solid ${theme.bgCard}` }}>{tokenGlyph(tokenB?.symbol)}</div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: theme.textPrimary, fontWeight: '700', fontSize: '20px' }}>{displayA} / {displayB}</span>
                    <span style={{ background: `${hookColor}20`, color: hookColor, fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{hookObj.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                    <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '600' }}>↗ 0.029% Fee</span>
                    <span style={{ color: theme.textSecondary, fontSize: '13px' }}>TVL <span style={{ color: theme.textPrimary, fontWeight: '600' }}>$315,790</span></span>
                    <span style={{ color: theme.textSecondary, fontSize: '13px' }}>APY <span style={{ color: '#10b981', fontWeight: '600' }}>1.45%</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
              {['Dynamic Fee', 'Volume', 'TVL'].map((tab, i) => (
                <button key={tab} style={{ padding: '6px 12px', borderRadius: '8px', background: i === 0 ? theme.bgSecondary : 'transparent', color: i === 0 ? theme.textPrimary : theme.textSecondary, border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>{tab}</button>
              ))}
            </div>
            <div style={{ flex: 1, minHeight: '250px' }}>
              <PoolActivityChart theme={theme} isDark={isDark} />
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Form */}
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
      </div>
    </div>
  );
};

export default AddLiquidityModal;

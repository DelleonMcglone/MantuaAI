import React from 'react';
import type { Token } from '../../config/tokens';
import { ChevronDownIcon } from '../icons';

const TOKEN_GRADIENT_MAP: Record<string, string> = {
  ETH:    'linear-gradient(135deg, #627EEA 0%, #8B9FFF 100%)',
  mUSDC:  'linear-gradient(135deg, #2775CA 0%, #4A9FE8 100%)',
  mUSDT:  'linear-gradient(135deg, #26A17B 0%, #50C878 100%)',
  mUSDE:  'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
  mUSDS:  'linear-gradient(135deg, #F59E0B 0%, #FCD34D 100%)',
  mUSDY:  'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)',
  mBUIDL: 'linear-gradient(135deg, #1F2937 0%, #374151 100%)',
  mstETH: 'linear-gradient(135deg, #00A3FF 0%, #5AC8FA 100%)',
  mcbETH: 'linear-gradient(135deg, #0052FF 0%, #3B7BF7 100%)',
  mWBTC:  'linear-gradient(135deg, #F7931A 0%, #FFAB4A 100%)',
  mWETH:  'linear-gradient(135deg, #627EEA 0%, #8B9FFF 100%)',
  mWSOL:  'linear-gradient(135deg, #9945FF 0%, #14F195 100%)',
  mBTC:   'linear-gradient(135deg, #F7931A 0%, #FFAB4A 100%)',
};
function getTokenGradient(symbol: string): string {
  if (TOKEN_GRADIENT_MAP[symbol]) return TOKEN_GRADIENT_MAP[symbol];
  if (symbol.includes('ETH')) return 'linear-gradient(135deg, #627EEA 0%, #8B9FFF 100%)';
  if (symbol.includes('BTC')) return 'linear-gradient(135deg, #F7931A 0%, #FFAB4A 100%)';
  if (symbol.includes('USD')) return 'linear-gradient(135deg, #2775CA 0%, #4A9FE8 100%)';
  if (symbol.includes('SOL')) return 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)';
  return 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)';
}

function getTokenGlyph(symbol: string): string {
  if (symbol.includes('ETH')) return 'Ξ';
  if (symbol.includes('BTC')) return '₿';
  if (symbol.includes('USD') || symbol.includes('DAI') || symbol.includes('FRAX')) return '$';
  return symbol.charAt(0);
}

interface LiquidityTokenInputProps {
  token: Token | null;
  amount: string;
  onAmountChange: (val: string) => void;
  onTokenClick: () => void;
  priceUsd: number;
  balance?: string;
  side: string;
  theme: any;
  isDark: boolean;
}

export const LiquidityTokenInput: React.FC<LiquidityTokenInputProps> = ({
  token, amount, onAmountChange, onTokenClick, priceUsd, balance = '0.00', side, theme, isDark,
}) => (
  <div style={{ background: theme.bgSecondary, borderRadius: '16px', padding: '16px', border: `1px solid ${theme.border}`, marginBottom: '4px' }}>
    {/* Top row: label + balance */}
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
      <span style={{ color: theme.textSecondary, fontSize: '14px', fontWeight: '500' }}>{side}</span>
      <span style={{ color: theme.textMuted, fontSize: '13px' }}>Balance: {balance}</span>
    </div>

    {/* Middle row: input + token button */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <input
          type="text"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.00"
          style={{ background: 'transparent', border: 'none', color: theme.textPrimary, fontSize: '32px', fontWeight: '600', width: '100%', outline: 'none', fontFamily: 'SF Mono, Monaco, monospace', marginBottom: '4px' }}
        />
        <div style={{ color: theme.textMuted, fontSize: '13px' }}>
          ≈ ${amount && priceUsd && !isNaN(parseFloat(amount)) ? (parseFloat(amount) * priceUsd).toFixed(2) : '0.00'}
        </div>
      </div>

      {/* Token pill button */}
      <button onClick={onTokenClick} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '9999px', border: isDark ? '1px solid #4b5563' : '1px solid #e5e7eb', background: isDark ? '#1f2937' : '#f3f4f6', color: isDark ? '#f3f4f6' : '#1f2937', cursor: 'pointer', fontSize: '15px', fontWeight: '600', flexShrink: 0, transition: 'background 0.2s ease' }}>
        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: token ? getTokenGradient(token.symbol) : 'linear-gradient(135deg, #9ca3af 0%, #d1d5db 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: 'white', flexShrink: 0 }}>
          {token ? getTokenGlyph(token.symbol) : '?'}
        </div>
        <span>{token?.symbol ?? 'Select'}</span>
        <ChevronDownIcon />
      </button>
    </div>

    {/* Bottom: current price */}
    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: theme.textMuted, fontSize: '12px', fontWeight: '500' }}>Current Price</span>
      <span style={{ color: theme.textSecondary, fontSize: '13px', fontWeight: '600' }}>${priceUsd > 0 ? priceUsd.toFixed(2) : '—'}</span>
    </div>
  </div>
);

import React from 'react';
import type { Token } from '../../config/tokens';
import { TokenSelector } from '../TokenSelector';

interface LiquidityAmountInputProps {
  token: Token | null;
  excludeToken: Token | null;
  amount: string;
  onAmountChange: (val: string) => void;
  onTokenChange: (t: Token) => void;
  priceUsd: number;
  theme: any;
  borderRadius?: string;
}

export const LiquidityAmountInput: React.FC<LiquidityAmountInputProps> = ({
  token, excludeToken, amount, onAmountChange, onTokenChange, priceUsd, theme, borderRadius = '12px',
}) => (
  <div style={{ background: theme.bgSecondary, padding: '16px', borderRadius }}>
    <span style={{ color: theme.textSecondary, fontSize: '12px', fontWeight: '600' }}>Amount</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
      <div style={{ minWidth: '140px' }}>
        <TokenSelector
          selectedToken={token ?? undefined}
          excludeToken={excludeToken ?? undefined}
          onSelect={onTokenChange}
          label="Select token"
        />
      </div>
      <div style={{ flex: 1, textAlign: 'right' }}>
        <input
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.0"
          style={{ background: 'transparent', border: 'none', textAlign: 'right', color: theme.textPrimary, fontSize: '20px', fontWeight: '600', width: '100%', outline: 'none' }}
        />
        <div style={{ color: theme.textSecondary, fontSize: '12px' }}>
          {amount && priceUsd && !isNaN(parseFloat(amount))
            ? `$${(parseFloat(amount) * priceUsd).toFixed(2)}`
            : '$0.00'}
        </div>
      </div>
    </div>
  </div>
);

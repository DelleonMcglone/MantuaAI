import React, { useState } from 'react';
import { ALL_TOKENS, type Token } from '../../config/tokens';
import { CloseIcon } from '../icons';

interface LiquidityTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  excludeToken: Token | null;
  theme: any;
  isDark: boolean;
}

const CATEGORIES = [
  { id: 'all',        label: 'All'      },
  { id: 'stablecoin', label: 'Stables'  },
  { id: 'rwa',        label: 'RWAs'     },
  { id: 'lst',        label: 'LSTs'     },
  { id: 'wrapped',    label: 'Wrapped'  },
];

function getGradient(symbol: string): string {
  const colorMap: Record<string, string> = {
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
  if (colorMap[symbol]) return colorMap[symbol];
  if (symbol.includes('ETH')) return 'linear-gradient(135deg, #627EEA 0%, #8B9FFF 100%)';
  if (symbol.includes('BTC')) return 'linear-gradient(135deg, #F7931A 0%, #FFAB4A 100%)';
  if (symbol.includes('USD')) return 'linear-gradient(135deg, #2775CA 0%, #4A9FE8 100%)';
  if (symbol.includes('SOL')) return 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)';
  return 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)';
}

function getGlyph(symbol: string): string {
  if (symbol.includes('ETH') || symbol.includes('stETH') || symbol.includes('cbETH')) return 'Ξ';
  if (symbol.includes('BTC')) return '₿';
  if (symbol.includes('USD') || symbol.includes('DAI') || symbol.includes('FRAX')) return '$';
  if (symbol.includes('SOL')) return '◎';
  return symbol.replace(/^m/, '').charAt(0);
}

function TokenLogo({ token, size = 40 }: { token: Token; size?: number }) {
  const bg = getGradient(token.symbol);
  const glyph = getGlyph(token.symbol);
  if (token.logoURI) {
    return (
      <div style={{ width: size, height: size, position: 'relative', flexShrink: 0, marginRight: '16px' }}>
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
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: size, height: size, borderRadius: '50%',
          background: bg, display: 'none',
          alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.45, fontWeight: '700', color: 'white',
        }}>
          {glyph}
        </div>
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, fontWeight: '700', color: 'white', marginRight: '16px', flexShrink: 0 }}>
      {glyph}
    </div>
  );
}

export const LiquidityTokenModal: React.FC<LiquidityTokenModalProps> = ({
  isOpen, onClose, onSelect, excludeToken, theme, isDark,
}) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  if (!isOpen) return null;

  const filtered = ALL_TOKENS.filter((t) => {
    if (excludeToken && t.address.toLowerCase() === excludeToken.address.toLowerCase()) return false;
    if (category !== 'all' && t.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
    }
    return true;
  });

  const handleSelect = (token: Token) => {
    onSelect(token);
    onClose();
    setSearch('');
    setCategory('all');
  };

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', borderRadius: '16px' }}>
      <div style={{ width: '100%', maxWidth: '480px', maxHeight: '90%', background: isDark ? '#13131a' : '#ffffff', borderRadius: '20px', border: `1px solid ${theme.border}`, boxShadow: '0 24px 48px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: theme.textPrimary }}>Select Token</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: theme.textSecondary, padding: '4px' }}><CloseIcon /></button>
        </div>

        {/* Search */}
        <div style={{ padding: '0 24px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', borderRadius: '12px', padding: '12px 16px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'transparent'}` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.textMuted} strokeWidth="2" style={{ marginRight: '10px', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" placeholder="Search token" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus style={{ background: 'transparent', border: 'none', outline: 'none', color: theme.textPrimary, fontSize: '16px', width: '100%' }} />
          </div>
        </div>

        {/* Category Tabs */}
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {CATEGORIES.map((cat) => (
            <button key={cat.id} onClick={() => setCategory(cat.id)} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s', background: category === cat.id ? 'linear-gradient(135deg, #a855f7, #9333ea)' : (isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6'), color: category === cat.id ? '#fff' : theme.textSecondary }}>
              {cat.label}
            </button>
          ))}
        </div>

        <div style={{ height: '1px', background: theme.border, opacity: 0.5, marginBottom: '8px' }} />

        {/* Token List */}
        <div style={{ padding: '0 8px 16px', overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: theme.textSecondary }}>No tokens found</div>
          ) : filtered.map((token) => (
            <button
              key={token.address}
              onClick={() => handleSelect(token)}
              style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '12px', marginBottom: '2px', transition: 'background 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <TokenLogo token={token} size={40} />
              <div>
                <div style={{ color: theme.textPrimary, fontWeight: '600', fontSize: '15px' }}>{token.symbol}</div>
                <div style={{ color: theme.textMuted, fontSize: '12px' }}>{token.name}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

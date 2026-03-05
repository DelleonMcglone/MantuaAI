import React, { useState } from 'react';
import { CloseIcon, StarIcon, CheckIcon, CodeIcon, ChevronUpIcon, ChevronDownIcon } from '../icons';

interface HookSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  hooks: any[];
  selectedHook: string;
  onSelect: (hookId: string) => void;
  theme: any;
  isDark: boolean;
}

const HookSelector: React.FC<HookSelectorProps> = ({ isOpen, onClose, hooks, selectedHook, onSelect, theme, isDark }) => {
  const [customAddress, setCustomAddress] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)',
      backdropFilter: 'blur(4px)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '20px',
    }}>
      <div style={{
        width: '90%',
        maxHeight: '90%',
        background: theme.bgCard,
        borderRadius: '20px',
        border: `1px solid ${theme.border}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '20px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: theme.textPrimary }}>Select Liquidity Hook</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: theme.textSecondary }}>
            <CloseIcon />
          </button>
        </div>
        
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)', 
            borderRadius: '12px', 
            padding: '16px', 
            marginBottom: '20px',
            border: '1px solid rgba(139, 92, 246, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ color: '#8b5cf6', marginTop: '2px' }}><StarIcon /></div>
              <div>
                <div style={{ fontWeight: '600', color: theme.textPrimary, marginBottom: '4px' }}>AI Recommendation</div>
                <div style={{ fontSize: '13px', color: theme.textSecondary, lineHeight: '1.5' }}>
                  For most pools, select <span style={{ fontWeight: '600', color: '#8b5cf6' }}>No Hook</span> for standard Uniswap v4 constant-product execution.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {hooks.map(hook => (
              <button
                key={hook.id}
                onClick={() => { onSelect(hook.id); onClose(); }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '16px',
                  borderRadius: '12px',
                  border: selectedHook === hook.id 
                    ? `2px solid ${hook.color || '#8b5cf6'}` 
                    : `1px solid ${theme.border}`,
                  background: selectedHook === hook.id 
                    ? (isDark ? `${hook.color || '#8b5cf6'}1a` : `${hook.color || '#8b5cf6'}0d`) 
                    : theme.bgSecondary,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  position: 'relative',
                }}
              >
                {hook.recommended && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Recommended
                  </div>
                )}
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: selectedHook === hook.id ? `${hook.color || '#8b5cf6'}33` : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: selectedHook === hook.id ? (hook.color || '#8b5cf6') : theme.textSecondary,
                  flexShrink: 0,
                }}>
                  {hook.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: theme.textPrimary, fontWeight: '600', fontSize: '15px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {hook.name}
                    {selectedHook === hook.id && <CheckIcon />}
                  </div>
                  <div style={{ color: theme.textSecondary, fontSize: '13px', lineHeight: '1.4', marginBottom: '8px' }}>{hook.description}</div>
                  {hook.benefit && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: '#10b981',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}>
                      {hook.benefit}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
          
          {/* Custom Hook Section */}
          <div style={{ marginTop: '20px' }}>
            <button 
              onClick={() => setShowCustomInput(!showCustomInput)}
              style={{ 
                width: '100%',
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '16px',
                borderRadius: '12px',
                border: showCustomInput 
                  ? '2px solid #8b5cf6'
                  : `1px solid ${theme.border}`,
                background: showCustomInput 
                  ? (isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)') 
                  : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
                color: theme.textPrimary
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: showCustomInput ? 'rgba(139, 92, 246, 0.2)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: showCustomInput ? '#8b5cf6' : theme.textSecondary,
                }}>
                  <CodeIcon />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: '600', fontSize: '15px', color: theme.textPrimary }}>Custom Hook Address</div>
                  <div style={{ fontSize: '13px', color: theme.textSecondary }}>Use your own deployed hook contract</div>
                </div>
              </div>
              {showCustomInput ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </button>

            {showCustomInput && (
              <div style={{ 
                marginTop: '12px', 
                padding: '20px', 
                background: theme.bgCard,
                border: `1px solid ${theme.border}`,
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
              }}>
                <input 
                  type="text" 
                  placeholder="Enter hook contract address (0x...)"
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '10px',
                    border: `1px solid ${theme.border}`,
                    background: theme.bgSecondary,
                    color: theme.textPrimary,
                    fontSize: '14px',
                    fontFamily: 'SF Mono, Monaco, monospace',
                    marginBottom: '12px',
                    outline: 'none'
                  }}
                />
                
                <button style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  background: theme.bgSecondary,
                  border: 'none',
                  color: theme.textSecondary,
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  marginBottom: '20px'
                }}>
                  Validate Address
                </button>

                <div style={{ fontSize: '11px', color: theme.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
                  Recent Custom Hooks
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  <div style={{ 
                    padding: '12px', 
                    borderRadius: '10px', 
                    border: `1px solid ${theme.border}`, 
                    background: theme.bgCard,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: theme.textPrimary }}>TWAMM Hook</div>
                      <div style={{ fontSize: '12px', color: theme.textSecondary, fontFamily: 'monospace' }}>0x1234...5678</div>
                    </div>
                    <div style={{ fontSize: '12px', color: theme.textMuted }}>2 days ago</div>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    if (customAddress) {
                      onSelect('custom');
                      onClose();
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                    border: 'none',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '15px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                  }}
                >
                  Apply Hook Selection
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HookSelector;

/**
 * Swap Confirmation Component
 * 
 * Shows transaction status and confirmation details:
 * - Transaction hash with explorer link
 * - Status indicator (pending, confirming, confirmed, failed)
 * - Retry button for failed transactions
 */

import React from 'react';
import type { SwapStatus } from '../../hooks/useSwapExecution';
import { getExplorerLink } from '../../hooks/useSwapExecution';

interface SwapConfirmationProps {
  status: SwapStatus;
  txHash?: `0x${string}`;
  error?: Error | null;
  inputAmount: string;
  outputAmount: string;
  inputSymbol: string;
  outputSymbol: string;
  onRetry: () => void;
  onClose: () => void;
  chainId?: number;
  theme: {
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    bgCard: string;
    bgSecondary: string;
    accent: string;
  };
  isDark: boolean;
}

export function SwapConfirmation({
  status,
  txHash,
  error,
  inputAmount,
  outputAmount,
  inputSymbol,
  outputSymbol,
  onRetry,
  onClose,
  chainId = 84532,
  theme,
  isDark,
}: SwapConfirmationProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: '⏳',
          title: 'Confirm in Wallet',
          description: 'Please confirm the transaction in your wallet',
          color: '#f59e0b',
          showSpinner: true,
        };
      case 'confirming':
        return {
          icon: '🔄',
          title: 'Transaction Submitted',
          description: 'Waiting for blockchain confirmation...',
          color: '#3b82f6',
          showSpinner: true,
        };
      case 'confirmed':
        return {
          icon: '✅',
          title: 'Swap Complete!',
          description: `Successfully swapped ${inputAmount} ${inputSymbol} for ${outputAmount} ${outputSymbol}`,
          color: '#10b981',
          showSpinner: false,
        };
      case 'failed':
        return {
          icon: '❌',
          title: 'Transaction Failed',
          description: error?.message || 'Something went wrong. Please try again.',
          color: '#ef4444',
          showSpinner: false,
        };
      default:
        return {
          icon: '📋',
          title: 'Review Swap',
          description: `Swapping ${inputAmount} ${inputSymbol} for ${outputAmount} ${outputSymbol}`,
          color: theme.textPrimary,
          showSpinner: false,
        };
    }
  };

  const config = getStatusConfig();

  const truncateHash = (hash: string) => {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  return (
    <div
      data-testid="swap-confirmation"
      style={{
        padding: '24px',
        borderRadius: '16px',
        background: theme.bgCard,
        border: `1px solid ${theme.border}`,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 16px',
          borderRadius: '50%',
          background: `${config.color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          position: 'relative',
        }}
      >
        {config.showSpinner ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              border: `3px solid ${config.color}30`,
              borderTopColor: config.color,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
        ) : null}
        <span>{config.icon}</span>
      </div>

      <h3
        style={{
          fontSize: '18px',
          fontWeight: '600',
          color: theme.textPrimary,
          marginBottom: '8px',
        }}
      >
        {config.title}
      </h3>

      <p
        style={{
          fontSize: '14px',
          color: theme.textSecondary,
          marginBottom: '20px',
          lineHeight: '1.5',
        }}
      >
        {config.description}
      </p>

      {txHash && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              color: theme.textMuted,
              marginBottom: '4px',
            }}
          >
            Transaction Hash
          </div>
          <a
            href={getExplorerLink(txHash, chainId)}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="tx-hash-link"
            style={{
              fontSize: '14px',
              color: '#3b82f6',
              textDecoration: 'none',
              fontFamily: 'monospace',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {truncateHash(txHash)}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        {status === 'failed' && (
          <button
            onClick={onRetry}
            data-testid="retry-button"
            style={{
              flex: 1,
              padding: '12px 20px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #a855f7, #9333ea)',
              border: 'none',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        )}

        <button
          onClick={onClose}
          data-testid="close-confirmation-button"
          style={{
            flex: 1,
            padding: '12px 20px',
            borderRadius: '10px',
            background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            border: `1px solid ${theme.border}`,
            color: theme.textPrimary,
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          {status === 'confirmed' ? 'Done' : 'Close'}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

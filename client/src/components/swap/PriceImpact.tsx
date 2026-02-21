/**
 * Price Impact Display Component
 * 
 * Shows price impact percentage with color coding:
 * - Green: < 1% (low impact)
 * - Yellow: 1-5% (medium impact)
 * - Red: > 5% (high impact)
 * 
 * Also displays exchange rate, minimum received, and fee information.
 */

import React from 'react';
import { getPriceImpactColor, getPriceImpactSeverity } from '../../hooks/useSwapQuote';
import { formatTokenAmount } from '../../lib/swap-utils';

interface PriceImpactProps {
  priceImpact: number;
  exchangeRate: string;
  minimumReceived: bigint;
  outputDecimals: number;
  outputSymbol: string;
  fee: bigint;
  inputDecimals: number;
  slippageTolerance: number;
  theme: {
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    bgSecondary: string;
  };
  isDark: boolean;
}

export function PriceImpact({
  priceImpact,
  exchangeRate,
  minimumReceived,
  outputDecimals,
  outputSymbol,
  fee,
  inputDecimals,
  slippageTolerance,
  theme,
  isDark,
}: PriceImpactProps) {
  const impactColor = getPriceImpactColor(priceImpact);
  const severity = getPriceImpactSeverity(priceImpact);

  const formattedMinReceived = formatTokenAmount(minimumReceived, outputDecimals);
  const formattedFee = formatTokenAmount(fee, inputDecimals);

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '12px',
        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        border: `1px solid ${theme.border}`,
        marginTop: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '13px', color: theme.textSecondary }}>
            Exchange Rate
          </span>
          <span style={{ fontSize: '13px', color: theme.textPrimary, fontWeight: '500' }}>
            {exchangeRate}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '13px', color: theme.textSecondary }}>
            Price Impact
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: impactColor,
              }}
            >
              {priceImpact < 0.01 ? priceImpact.toFixed(4) : priceImpact.toFixed(2)}%
            </span>
            {severity === 'high' && (
              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  fontWeight: '600',
                }}
              >
                HIGH
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '13px', color: theme.textSecondary }}>
            Minimum Received
          </span>
          <span style={{ fontSize: '13px', color: theme.textPrimary, fontWeight: '500' }}>
            {formattedMinReceived} {outputSymbol}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '13px', color: theme.textSecondary }}>
            Slippage Tolerance
          </span>
          <span style={{ fontSize: '13px', color: theme.textPrimary, fontWeight: '500' }}>
            {slippageTolerance}%
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '13px', color: theme.textSecondary }}>
            Network Fee
          </span>
          <span style={{ fontSize: '13px', color: theme.textMuted }}>
            ~$0.01
          </span>
        </div>
      </div>

      {severity === 'high' && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>⚠️</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#ef4444', marginBottom: '2px' }}>
                High Price Impact
              </div>
              <div style={{ fontSize: '11px', color: theme.textSecondary, lineHeight: '1.4' }}>
                This trade will move the market price significantly. Consider reducing your trade size.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PriceImpactBadge({ priceImpact }: { priceImpact: number }) {
  const color = getPriceImpactColor(priceImpact);
  const severity = getPriceImpactSeverity(priceImpact);

  return (
    <span
      data-testid="price-impact-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '600',
        color: color,
        background: `${color}15`,
      }}
    >
      {priceImpact < 0.01 ? priceImpact.toFixed(4) : priceImpact.toFixed(2)}%
      {severity === 'high' && ' ⚠️'}
    </span>
  );
}

// @ts-nocheck
/**
 * Mantua.AI App Home Page
 * 
 * Main application interface with sidebar navigation, wallet connection,
 * chat interface, and swap functionality for DeFi interactions.
 */

import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { useLocation } from 'wouter';
import { useAccount, useBalance, useSwitchChain, useChainId } from 'wagmi';
import logoWhite from '@assets/Mantua_logo_white_1768946648374.png';
import logoBlack from '@assets/Mantua_logo_black_1768946648374.png';
import { ChatMessageList } from '../components/chat/ChatMessageList';
import { DuneResultTable } from '../components/DuneResultTable';
import { ChatInput } from '../components/chat/ChatInput';
import { useChat } from '../hooks/useChat';
import AddLiquidityModal from '../components/liquidity/AddLiquidityModal';
import { classifyQuery } from '../utils/queryClassifier';
import { isAnalyticsQuery, generateAnalyticsQuery } from '../lib/analyticsEngine';
import { gqlQuery } from '../lib/graphql';
import { normalizeForChart } from '../lib/normalizeSubgraphData';
// Heavy views loaded lazily for bundle splitting
import { TxHistoryPanel }  from '../components/portfolio/TxHistoryPanel';
import { useTxHistory }    from '../hooks/useTxHistory';
import { sanitizeInput }   from '../lib/sanitize';
import { trackEvent }      from '../lib/trackEvent';
import { ConnectButton } from '../components/wallet/ConnectButton';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { useTokenApproval } from '../hooks/useTokenApproval';
import { useSwapQuote, getPriceImpactSeverity } from '../hooks/useSwapQuote';
import { useSwapExecution, getExplorerLink } from '../hooks/useSwapExecution';
import { useTokenBalances } from '../hooks/useTokenBalances';
import { PriceImpact, SwapButton, SwapButtonStyles, SwapConfirmation, SwapPriceChart } from '../components/swap';
import { parseTokenAmount, formatTokenAmount, isNativeEth, getZeroAddress, getHookAddress } from '../lib/swap-utils';
import { ALL_TOKENS, NATIVE_ETH, getTokenBySymbol } from '../config/tokens';
import { calculateUsdValue as calcUsdValue, getPriceBySymbol } from '../services/priceService';
import { useLivePriceUSD, useLivePairRate } from '../hooks/useLivePriceUSD';
import {
  WalletIcon,
  TrendUpIcon,
  TrendDownIcon,
  PlusCircleIcon,
  MinusCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  UserIcon,
  SunIcon,
  MoonIcon,
  MessageSquarePlusIcon,
  MessageSquareIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowLeftRightIcon,
  DropletsIcon,
  DropletIcon,
  ExternalLinkIcon,
  FileTextIcon,
  SendIcon,
  MicIcon,
  SwapIcon,
  ShieldIcon,
  BoltIcon,
  TrendIcon,
  CodeIcon,
  CheckIcon,
  InfoIcon,
  CloseIcon,
  StarIcon,
  BotIcon,
  XIcon,
  FarcasterIcon,
  TrashIcon,
  PlusIcon,
  SearchIcon,
  MenuIcon,
  LockIcon,
  CoinsIcon
} from '../components/icons';

// ============ ICONS ============
// Icons are now imported from ../components/icons.tsx


// Token icon component — uses logoURI from token config with character fallback
const TokenIcon = ({ token, size = 32 }) => {
  const tokenData = ALL_TOKENS.find(t => t.symbol === token);
  const logoURI = tokenData?.logoURI ?? null;

  const getTokenColor = (t: string) => {
    const colors: Record<string, string> = {
      'ETH':   'linear-gradient(135deg, #627EEA 0%, #8B9FFF 100%)',
      'cbBTC': 'linear-gradient(135deg, #F7931A 0%, #FFB347 100%)',
      'USDC':  'linear-gradient(135deg, #2775CA 0%, #4A9FE8 100%)',
      'EURC':  'linear-gradient(135deg, #0052B4 0%, #2E86AB 100%)',
    };
    return colors[t] || 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)';
  };

  const getTokenSymbol = (t: string) => {
    if (t === 'ETH' || t.endsWith('ETH')) return 'Ξ';
    if (t === 'cbBTC') return '₿';
    if (t === 'USDC') return '$';
    if (t === 'EURC') return '€';
    return t.charAt(0);
  };

  const fallbackChar = getTokenSymbol(token);
  const bg = getTokenColor(token);

  if (logoURI) {
    return (
      <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
        <img
          src={logoURI}
          alt={token}
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
          fontSize: size * 0.45, fontWeight: '600', color: 'white',
        }}>
          {fallbackChar}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, fontWeight: '600', color: 'white',
    }}>
      {fallbackChar}
    </div>
  );
};

// Token pair icon
const TokenPairIcon = ({ token1, token2, size = 28 }) => (
  <div style={{ display: 'flex', alignItems: 'center' }}>
    <TokenIcon token={token1} size={size} />
    <div style={{ marginLeft: -(size * 0.3), zIndex: 1 }}>
      <TokenIcon token={token2} size={size} />
    </div>
  </div>
);

// Status badge component
const StatusBadge = ({ status, type = 'default' }) => {
  const configs = {
    'Manual': { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' },
    'Active': { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    'Paused': { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    'Out of range': { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    'Pending': { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    'Completed': { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    'Failed': { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    'Standard': { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' },
    'None': { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' },
  };

  const config = configs[status] || configs['default'];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 10px',
      borderRadius: '6px',
      background: config.bg,
      color: config.color,
      fontSize: '12px',
      fontWeight: '600',
    }}>
      {status === 'Active' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: config.color }} />}
      {status}
    </span>
  );
};

// Chain badge - now accepts chain prop
const ChainBadge = ({ chain }) => {
  const chainConfig = chain || { name: 'Base Sepolia', color: '#3b82f6' };
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 12px',
      borderRadius: '8px',
      background: `${chainConfig.color}15`,
      color: chainConfig.color,
      fontSize: '12px',
      fontWeight: '600',
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: chainConfig.color,
      }} />
      {chainConfig.name}
    </div>
  );
};

// Portfolio Summary Card
const PortfolioSummary = ({ data, theme, currentChain }) => (
  <div style={{
    background: theme.bgCard,
    borderRadius: '16px',
    padding: '24px',
    border: `1px solid ${theme.border}`,
    marginBottom: '24px',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <h2 style={{ color: theme.textPrimary, fontSize: '18px', fontWeight: '700', margin: 0 }}>
            Portfolio Summary
          </h2>
        </div>
        <ChainBadge chain={currentChain} />
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ color: theme.textSecondary, fontSize: '13px', marginBottom: '4px' }}>Total Value</div>
        <div style={{ 
          color: theme.textPrimary, 
          fontSize: '32px', 
          fontWeight: '700',
          fontFamily: 'SF Mono, Monaco, monospace',
        }}>
          ${data.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
      <div style={{
        padding: '16px',
        background: theme.bgSecondary,
        borderRadius: '12px',
        border: `1px solid ${theme.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <TokenIcon token="ETH" size={24} />
          <span style={{ color: theme.textSecondary, fontSize: '13px', fontWeight: '500' }}>ETH Balance</span>
        </div>
        <div style={{ 
          color: theme.textPrimary, 
          fontSize: '20px', 
          fontWeight: '700',
          fontFamily: 'SF Mono, Monaco, monospace',
        }}>
          {data.ethBalance.toFixed(4)} ETH
        </div>
        <div style={{ color: theme.textMuted, fontSize: '12px', marginTop: '2px' }}>
          ${(data.ethBalance * data.ethPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      <div style={{
        padding: '16px',
        background: theme.bgSecondary,
        borderRadius: '12px',
        border: `1px solid ${theme.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <TokenIcon token="USDC" size={24} />
          <span style={{ color: theme.textSecondary, fontSize: '13px', fontWeight: '500' }}>USDC Balance</span>
        </div>
        <div style={{ 
          color: theme.textPrimary, 
          fontSize: '20px', 
          fontWeight: '700',
          fontFamily: 'SF Mono, Monaco, monospace',
        }}>
          {data.usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div style={{ color: theme.textMuted, fontSize: '12px', marginTop: '2px' }}>
          ${data.usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      <div style={{
        padding: '16px',
        background: theme.bgSecondary,
        borderRadius: '12px',
        border: `1px solid ${theme.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <TokenIcon token="LP" size={24} />
          <span style={{ color: theme.textSecondary, fontSize: '13px', fontWeight: '500' }}>LP Positions</span>
        </div>
        <div style={{ 
          color: theme.textPrimary, 
          fontSize: '20px', 
          fontWeight: '700',
          fontFamily: 'SF Mono, Monaco, monospace',
        }}>
          {data.lpPositions}
        </div>
        <div style={{ color: theme.textMuted, fontSize: '12px', marginTop: '2px' }}>
          ${data.lpValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} value
        </div>
      </div>

      <div style={{
        padding: '16px',
        background: data.netPnl >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
        borderRadius: '12px',
        border: `1px solid ${data.netPnl >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          {data.netPnl >= 0 ? <TrendUpIcon /> : <TrendDownIcon />}
          <span style={{ color: theme.textSecondary, fontSize: '13px', fontWeight: '500' }}>Net PnL</span>
        </div>
        <div style={{ 
          color: data.netPnl >= 0 ? '#10b981' : '#ef4444', 
          fontSize: '20px', 
          fontWeight: '700',
          fontFamily: 'SF Mono, Monaco, monospace',
        }}>
          {data.netPnl >= 0 ? '+' : ''}{data.netPnl.toFixed(2)}%
        </div>
        <div style={{ color: data.netPnl >= 0 ? '#10b981' : '#ef4444', fontSize: '12px', marginTop: '2px' }}>
          {data.netPnl >= 0 ? '+' : ''}${data.netPnlUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    </div>
  </div>
);

// Assets Table
const AssetsTable = ({ assets, theme }) => (
  <div style={{
    background: theme.bgCard,
    borderRadius: '16px',
    border: `1px solid ${theme.border}`,
    marginBottom: '24px',
    overflow: 'hidden',
  }}>
    <div style={{ padding: '20px 24px', borderBottom: `1px solid ${theme.border}` }}>
      <h3 style={{ color: theme.textPrimary, fontSize: '16px', fontWeight: '700', margin: 0 }}>Assets</h3>
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: theme.bgSecondary }}>
          <th style={{ padding: '12px 24px', textAlign: 'left', color: theme.textSecondary, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Asset</th>
          <th style={{ padding: '12px 24px', textAlign: 'right', color: theme.textSecondary, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Balance</th>
          <th style={{ padding: '12px 24px', textAlign: 'right', color: theme.textSecondary, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>USD Value</th>
          <th style={{ padding: '12px 24px', textAlign: 'right', color: theme.textSecondary, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>% of Portfolio</th>
        </tr>
      </thead>
      <tbody>
        {assets.map((asset, index) => (
          <tr key={index} style={{ borderBottom: `1px solid ${theme.border}` }}>
            <td style={{ padding: '16px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <TokenIcon token={asset.symbol} size={36} />
                <div>
                  <div style={{ color: theme.textPrimary, fontWeight: '600', fontSize: '14px' }}>{asset.name}</div>
                  <div style={{ color: theme.textSecondary, fontSize: '12px' }}>{asset.symbol}</div>
                </div>
              </div>
            </td>
            <td style={{ padding: '16px 24px', textAlign: 'right' }}>
              <span style={{ color: theme.textPrimary, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '14px', fontWeight: '500' }}>
                {asset.balance.toLocaleString(undefined, { minimumFractionDigits: asset.symbol === 'ETH' ? 4 : 2, maximumFractionDigits: asset.symbol === 'ETH' ? 4 : 2 })}
              </span>
            </td>
            <td style={{ padding: '16px 24px', textAlign: 'right' }}>
              <span style={{ color: theme.textPrimary, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '14px', fontWeight: '500' }}>
                ${asset.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </td>
            <td style={{ padding: '16px 24px', textAlign: 'right' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <div style={{
                  width: '60px',
                  height: '6px',
                  background: theme.bgSecondary,
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${asset.percentage}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #8b5cf6, #6366f1)',
                    borderRadius: '3px',
                  }} />
                </div>
                <span style={{ color: theme.textSecondary, fontSize: '13px', fontWeight: '600', minWidth: '45px' }}>
                  {asset.percentage.toFixed(1)}%
                </span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Liquidity Positions
const LiquidityPositions = ({ positions, theme, onRemoveLiquidity = null }) => (
  <div style={{
    background: theme.bgCard,
    borderRadius: '16px',
    border: `1px solid ${theme.border}`,
    marginBottom: '24px',
    overflow: 'hidden',
  }}>
    <div style={{ padding: '20px 24px', borderBottom: `1px solid ${theme.border}` }}>
      <h3 style={{ color: theme.textPrimary, fontSize: '16px', fontWeight: '700', margin: 0 }}>Liquidity Positions</h3>
    </div>

    {positions.length === 0 ? (
      <div style={{ padding: '48px', textAlign: 'center', color: theme.textSecondary }}>
        <p style={{ fontSize: '14px' }}>No liquidity positions yet</p>
      </div>
    ) : (
      <div style={{ padding: '16px' }}>
        {positions.map((position, index) => (
          <div
            key={index}
            style={{
              padding: '16px',
              background: theme.bgSecondary,
              borderRadius: '12px',
              marginBottom: index < positions.length - 1 ? '12px' : 0,
              border: `1px solid ${theme.border}`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <TokenPairIcon token1={position.token1} token2={position.token2} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ color: theme.textPrimary, fontWeight: '600', fontSize: '15px' }}>
                      {position.token1} / {position.token2}
                    </span>
                    <StatusBadge status={position.status} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <StatusBadge status={position.hookName || 'Standard'} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: theme.textSecondary, fontSize: '12px', marginBottom: '2px' }}>TVL in Position</div>
                  <div style={{
                    color: theme.textPrimary,
                    fontSize: '18px',
                    fontWeight: '700',
                    fontFamily: 'SF Mono, Monaco, monospace',
                  }}>
                    ${position.tvl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                {onRemoveLiquidity && (
                  <button
                    onClick={() => onRemoveLiquidity(position)}
                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '600', borderRadius: '8px', border: `1px solid ${theme.border}`, background: 'transparent', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.background = 'transparent'; }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '24px',
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: `1px solid ${theme.border}`,
            }}>
              <div>
                <span style={{ color: theme.textSecondary, fontSize: '12px' }}>Fees Earned</span>
                <div style={{ color: '#10b981', fontSize: '14px', fontWeight: '600', fontFamily: 'SF Mono, Monaco, monospace' }}>
                  +${position.feesEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <span style={{ color: theme.textSecondary, fontSize: '12px' }}>Fee Tier</span>
                <div style={{ color: theme.textPrimary, fontSize: '14px', fontWeight: '600' }}>
                  {position.feeTier}%
                </div>
              </div>
              <div>
                <span style={{ color: theme.textSecondary, fontSize: '12px' }}>Range</span>
                <div style={{ color: theme.textPrimary, fontSize: '14px', fontWeight: '600', fontFamily: 'SF Mono, Monaco, monospace' }}>
                  {position.rangeLow} - {position.rangeHigh}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// Activity Item
const ActivityItem = ({ activity, theme }) => {
  const getActionIcon = (type) => {
    switch (type) {
      case 'Swap': return <SwapIcon />;
      case 'Add Liquidity': return <PlusCircleIcon />;
      case 'Remove Liquidity': return <MinusCircleIcon />;
      case 'Hook Action': return <BoltIcon />;
      default: return <SwapIcon />;
    }
  };

  const getActionColor = (type) => {
    switch (type) {
      case 'Swap': return '#3b82f6';
      case 'Add Liquidity': return '#10b981';
      case 'Remove Liquidity': return '#f59e0b';
      case 'Hook Action': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed': return <CheckCircleIcon />;
      case 'Pending': return <ClockIcon />;
      case 'Failed': return <XCircleIcon />;
      default: return <CheckCircleIcon />;
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '16px',
      borderBottom: '1px solid rgba(139, 92, 246, 0.08)',
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        background: `${getActionColor(activity.type)}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: getActionColor(activity.type),
        flexShrink: 0,
      }}>
        {getActionIcon(activity.type)}
      </div>
      
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ color: '#111827', fontWeight: '600', fontSize: '14px' }}>
            {activity.type}
          </span>
          <StatusBadge status={activity.status} />
        </div>
        <div style={{ color: '#374151', fontSize: '13px', marginBottom: '4px' }}>
          {activity.description}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px',
            color: '#6b7280',
            fontSize: '12px',
          }}>
            {activity.initiator === 'Agent' ? <BotIcon /> : <UserIcon />}
            {activity.initiator}
          </div>
          <span style={{ color: '#9ca3af', fontSize: '12px' }}>
            {activity.timestamp}
          </span>
          <a
            href={`https://sepolia.basescan.org/tx/${activity.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: '#8b5cf6',
              fontSize: '12px',
              textDecoration: 'none',
            }}
          >
            {activity.txHash.slice(0, 6)}...{activity.txHash.slice(-4)}
            <ExternalLinkIcon />
          </a>
        </div>
      </div>
      
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ 
          color: '#111827', 
          fontSize: '14px', 
          fontWeight: '600',
          fontFamily: 'SF Mono, Monaco, monospace',
        }}>
          {activity.amount}
        </div>
        {activity.amountUsd && (
          <div style={{ color: '#6b7280', fontSize: '12px' }}>
            ${activity.amountUsd}
          </div>
        )}
      </div>
    </div>
  );
};

// Activity Feed
const ActivityFeed = ({ activities, filter, setFilter, theme }) => {
  const filters = ['All', 'Swaps', 'Liquidity'];
  
  const filteredActivities = activities.filter(a => {
    if (filter === 'All') return true;
    if (filter === 'Swaps' && a.type === 'Swap') return true;
    if (filter === 'Liquidity' && (a.type === 'Add Liquidity' || a.type === 'Remove Liquidity')) return true;
    return false;
  });

  return (
    <div style={{
      background: theme.bgCard,
      borderRadius: '16px',
      border: `1px solid ${theme.border}`,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '20px 24px',
        borderBottom: `1px solid ${theme.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h3 style={{ color: theme.textPrimary, fontSize: '16px', fontWeight: '700', margin: 0 }}>Activity</h3>
        
        <div style={{ display: 'flex', gap: '8px', background: theme.bgSecondary, padding: '4px', borderRadius: '8px' }}>
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: filter === f ? theme.bgCard : 'transparent',
                color: filter === f ? theme.textPrimary : theme.textSecondary,
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: filter === f ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      
      {filteredActivities.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: theme.textSecondary }}>
          <p style={{ fontSize: '14px' }}>No recent activity</p>
        </div>
      ) : (
        <div>
          {filteredActivities.map((activity, index) => (
            <ActivityItem key={index} activity={activity} theme={theme} />
          ))}
        </div>
      )}
    </div>
  );
};

// ============ PORTFOLIO INTERFACE (Hyperliquid-inspired) ============
const TESTNET_PRICES: Record<string, number> = { ETH: 2000, USDC: 1, EURC: 1.06, cbBTC: 50000 };

const ZoneBadge = ({ zone }) => {
  const cfg = {
    HEALTHY: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'HEALTHY' },
    MINOR: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'MINOR' },
    MODERATE: { color: '#f97316', bg: 'rgba(249,115,22,0.12)', label: 'MODERATE' },
    SEVERE: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'SEVERE' },
    CRITICAL: { color: '#7c3aed', bg: 'rgba(124,58,237,0.12)', label: 'CRITICAL' },
  }[zone] || { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'HEALTHY' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: '4px', background: cfg.bg, color: cfg.color, fontSize: '11px', fontWeight: '700', letterSpacing: '0.04em' }}>
      {cfg.label}
    </span>
  );
};

const PortfolioInterface = ({ onClose, type, theme, isDark, isConnected, currentChain, onRemoveLiquidity }) => {
  const [activeTab, setActiveTab] = useState('balances');
  const [txns, setTxns] = useState<Array<{type:string;tx_hash:string;token_in?:string;token_out?:string;amount_in?:string;amount_out?:string;timestamp:string;base_scan_url:string}>>([]);
  const [agentWallet, setAgentWallet] = useState<{address:string;wallet_id:string;id?:string} | null>(null);
  const [agentTxns, setAgentTxns] = useState<Array<{type:string;tx_hash:string;token_in?:string;token_out?:string;base_scan_url:string;timestamp:string}>>([]);
  const [positions, setPositions] = useState<Array<{id:string;token0:string;token1:string;liquidity:string;amount0:string;amount1:string;fee_tier:number;status:string}>>([]);
  const [hideSmall, setHideSmall] = useState(false);
  const isAgentView = type === 'Agent';

  const { address } = useAccount();
  const chainId = useChainId();
  const { data: liveEthBalance } = useBalance({ address, chainId, query: { enabled: !!address && isConnected, refetchInterval: 30_000 } });
  const { balancesBySymbol } = useTokenBalances();
  const { price: ethPriceUSD } = useLivePriceUSD('ETH');

  const ethBalanceNum = liveEthBalance ? (parseFloat(liveEthBalance.formatted) || 0) : 0;
  const ethPrice = (ethPriceUSD != null && !isNaN(ethPriceUSD)) ? ethPriceUSD : TESTNET_PRICES.ETH;
  const ethValueUSD = ethBalanceNum * ethPrice;
  const usdcBalance = parseFloat(balancesBySymbol['USDC']?.formatted ?? '0') || 0;
  const eurcBalance = parseFloat(balancesBySymbol['EURC']?.formatted ?? '0') || 0;
  const cbbtcBalance = parseFloat(balancesBySymbol['cbBTC']?.formatted ?? '0') || 0;
  const eurcPrice = TESTNET_PRICES.EURC;
  const cbbtcPrice = TESTNET_PRICES.cbBTC;
  const totalValue = (isNaN(ethValueUSD) ? 0 : ethValueUSD) + usdcBalance + (eurcBalance * eurcPrice) + (cbbtcBalance * cbbtcPrice);
  const safeTotal = isNaN(totalValue) ? 0 : totalValue;

  // Explorer URL based on chain
  const explorerBase = chainId === 1301 ? 'https://sepolia.uniscan.xyz' : 'https://sepolia.basescan.org';
  const explorerLabel = chainId === 1301 ? 'Uniscan' : 'BaseScan';

  useEffect(() => {
    if (!address || !isConnected) return;
    fetch(`/api/portfolio/transactions?walletAddress=${address}`)
      .then(r => r.ok ? r.json() : [])
      .then(rows => setTxns(rows ?? []))
      .catch(() => {});
  }, [address, isConnected]);

  useEffect(() => {
    if (!address) return;
    fetch(`/api/portfolio/agent-wallets?userId=${address}`)
      .then(r => r.ok ? r.json() : null)
      .then(wallet => {
        if (wallet) {
          setAgentWallet(wallet);
          return fetch(`/api/portfolio/agent-transactions?agentWalletId=${wallet.id}`);
        }
      })
      .then(r => r ? (r.ok ? r.json() : []) : [])
      .then(rows => setAgentTxns(rows ?? []))
      .catch(() => {});
  }, [address]);

  useEffect(() => {
    if (!address) return;
    fetch(`/api/portfolio/positions?walletAddress=${address}`)
      .then(r => r.ok ? r.json() : [])
      .then(rows => setPositions(rows ?? []))
      .catch(() => {});
  }, [address]);

  const tokenRows = [
    { symbol: 'ETH', name: 'Ethereum', balance: ethBalanceNum, usdValue: isNaN(ethValueUSD) ? 0 : ethValueUSD, price: ethPrice },
    { symbol: 'USDC', name: 'USD Coin', balance: usdcBalance, usdValue: usdcBalance, price: 1 },
    ...(chainId === 84532 ? [
      { symbol: 'EURC', name: 'Euro Coin', balance: eurcBalance, usdValue: eurcBalance * eurcPrice, price: eurcPrice },
      { symbol: 'cbBTC', name: 'Coinbase BTC', balance: cbbtcBalance, usdValue: cbbtcBalance * cbbtcPrice, price: cbbtcPrice },
    ] : []),
  ].filter(t => !hideSmall || t.usdValue >= 1);

  const fmtUSD = (v: number) => `$${(isNaN(v) ? 0 : v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtBal = (v: number, sym: string) => {
    const dec = sym === 'ETH' ? 6 : sym === 'cbBTC' ? 6 : 2;
    return (isNaN(v) ? 0 : v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: dec });
  };
  const fmtTime = (ts: string) => { try { return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ts; } };

  const tabStyle = (tab: string) => ({
    padding: '10px 16px', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
    background: activeTab === tab ? theme.bgCard : 'transparent',
    color: activeTab === tab ? theme.textPrimary : theme.textSecondary,
    border: `1px solid ${activeTab === tab ? theme.border : 'transparent'}`,
    borderBottom: activeTab === tab ? `1px solid ${theme.bgCard}` : `1px solid ${theme.border}`,
    whiteSpace: 'nowrap' as const,
  });

  // Simulated flat chart data for the value line
  const chartPoints = Array.from({ length: 20 }, (_, i) => safeTotal * (0.98 + 0.02 * (i / 19)));
  const chartMax = Math.max(...chartPoints);
  const chartMin = Math.min(...chartPoints) * 0.99;
  const chartRange = chartMax - chartMin || 1;
  const chartW = 300; const chartH = 80;
  const svgPoints = chartPoints.map((v, i) => {
    const x = (i / (chartPoints.length - 1)) * chartW;
    const y = chartH - ((v - chartMin) / chartRange) * chartH;
    return `${x},${y}`;
  }).join(' ');

  const cardStyle = {
    background: theme.bgCard,
    borderRadius: '12px',
    border: `1px solid ${theme.border}`,
    padding: '20px',
  };

  if (isAgentView) {
    return (
      <div style={{ width: '100%', fontFamily: '"DM Sans", sans-serif' }}>
        <div style={{ background: theme.bgSecondary, borderRadius: '16px', border: `1px solid ${theme.border}`, padding: '24px', maxHeight: '85vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: theme.textPrimary }}>Agent Portfolio</h2>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', color: theme.textSecondary }}><CloseIcon /></button>
          </div>
          {!agentWallet ? (
            <div style={{ padding: '40px', textAlign: 'center', ...cardStyle }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🤖</div>
              <div style={{ color: theme.textPrimary, fontWeight: '600', marginBottom: '8px' }}>No Agent Wallet</div>
              <div style={{ color: theme.textMuted, fontSize: '13px' }}>Create an agent wallet first → Go to Agent → Chat Mode → Create & Manage Wallet</div>
            </div>
          ) : (
            <div>
              <div style={{ ...cardStyle, marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent Wallet Address</div>
                <div style={{ fontFamily: 'monospace', fontSize: '13px', color: theme.textPrimary, wordBreak: 'break-all', marginBottom: '8px' }}>{agentWallet.address}</div>
                <a href={`${explorerBase}/address/${agentWallet.address}`} target="_blank" rel="noopener noreferrer" style={{ color: '#14b8a6', fontSize: '12px', textDecoration: 'none' }}>View on {explorerLabel} →</a>
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: theme.textPrimary, marginBottom: '12px' }}>Agent Transactions</div>
              {agentTxns.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: theme.textMuted, ...cardStyle }}>No agent transactions yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {agentTxns.map((t, i) => (
                    <div key={i} style={{ ...cardStyle, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '13px', color: theme.textPrimary, marginBottom: '4px' }}>{t.type?.toUpperCase()}</div>
                        {t.token_in && t.token_out && <div style={{ fontSize: '12px', color: theme.textSecondary }}>{t.token_in} → {t.token_out}</div>}
                        <div style={{ fontSize: '11px', color: theme.textMuted }}>{fmtTime(t.timestamp)}</div>
                      </div>
                      <a href={t.base_scan_url} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)', color: '#14b8a6', fontSize: '12px', textDecoration: 'none' }}>View Tx →</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', fontFamily: '"DM Sans", sans-serif' }}>
      <div style={{ background: theme.bgSecondary, borderRadius: '16px', border: `1px solid ${theme.border}`, padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: theme.textPrimary }}>Portfolio</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.25)', color: '#14b8a6', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Deposit</button>
            <button style={{ padding: '8px 16px', borderRadius: '8px', background: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.textSecondary, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Send</button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', color: theme.textSecondary }}><CloseIcon /></button>
          </div>
        </div>

        {/* Top 3 Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>

          {/* Card 1: Total Portfolio Value */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Value</div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: theme.textPrimary, fontFamily: 'SF Mono, Monaco, monospace', letterSpacing: '-0.02em' }}>
              {fmtUSD(safeTotal)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              {tokenRows.map(t => t.balance > 0 && (
                <div key={t.symbol} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TokenIcon token={t.symbol} size={18} />
                  <span style={{ flex: 1, fontSize: '12px', color: theme.textSecondary }}>{fmtBal(t.balance, t.symbol)} {t.symbol}</span>
                  <span style={{ fontSize: '12px', color: theme.textMuted, fontFamily: 'monospace' }}>{fmtUSD(t.usdValue)}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: '11px', color: theme.textMuted }}>Fees (Swap)</div>
              <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '2px' }}>
                Taker 0.05% / 0.30% · <span style={{ color: '#14b8a6', cursor: 'pointer' }}>Dynamic (Hook pools)</span>
              </div>
            </div>
          </div>

          {/* Card 2: Account Breakdown */}
          <div style={{ ...cardStyle }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: theme.textPrimary }}>Spot + LP</div>
              <div style={{ fontSize: '11px', color: theme.textMuted, background: theme.bgSecondary, padding: '3px 8px', borderRadius: '6px', border: `1px solid ${theme.border}` }}>30D</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'PNL', value: fmtUSD(0), color: theme.textSecondary },
                { label: 'Volume', value: fmtUSD(0), color: theme.textSecondary },
                { label: 'Total Equity', value: fmtUSD(safeTotal), color: theme.textPrimary },
                { label: 'LP Equity', value: fmtUSD(positions.reduce((s, p) => s + (parseFloat(p.amount0 || '0') + parseFloat(p.amount1 || '0')), 0)), color: theme.textSecondary },
                { label: 'Spot Equity', value: fmtUSD(safeTotal), color: theme.textSecondary },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: theme.textSecondary }}>{row.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: row.color, fontFamily: 'SF Mono, monospace' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Account Value Chart */}
          <div style={{ ...cardStyle }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: theme.textPrimary, marginBottom: '4px' }}>Account Value</div>
            <div style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '16px' }}>PNL: <span style={{ color: theme.textSecondary }}>$0.00</span></div>
            <div style={{ position: 'relative', height: `${chartH}px`, overflow: 'hidden' }}>
              <svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="portfolioGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3"/>
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <polygon points={`0,${chartH} ${svgPoints} ${chartW},${chartH}`} fill="url(#portfolioGrad)"/>
                <polyline points={svgPoints} fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <span style={{ fontSize: '11px', color: theme.textMuted }}>30 days ago</span>
              <span style={{ fontSize: '11px', color: theme.textMuted }}>Now</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '2px', marginBottom: '-1px', overflowX: 'auto' }}>
          {['balances', 'lp', 'swaps', 'pools', 'deposits'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(tab)}>
              {{ balances: 'Balances', lp: 'LP Positions', swaps: 'Swap History', pools: 'Pool History', deposits: 'Deposits' }[tab]}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ ...cardStyle, borderRadius: '0 12px 12px 12px', minHeight: '200px' }}>

          {/* Balances Tab */}
          {activeTab === 'balances' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: theme.textSecondary, cursor: 'pointer' }}>
                  <input type="checkbox" checked={hideSmall} onChange={e => setHideSmall(e.target.checked)} style={{ accentColor: '#14b8a6' }} />
                  Hide Small Balances (&lt;$1)
                </label>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Coin', 'Total Balance', 'Available', 'USD Value', 'Pool Share', 'Action'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Coin' ? 'left' : 'right', fontSize: '11px', fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${theme.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tokenRows.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: theme.textMuted, fontSize: '13px' }}>No balances yet</td></tr>
                  ) : tokenRows.map(t => (
                    <tr key={t.symbol} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TokenIcon token={t.symbol} size={28} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: theme.textPrimary }}>{t.symbol}</div>
                          <div style={{ fontSize: '11px', color: theme.textMuted }}>{t.name}</div>
                        </div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: theme.textPrimary, fontFamily: 'monospace' }}>{fmtBal(t.balance, t.symbol)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: theme.textSecondary, fontFamily: 'monospace' }}>{fmtBal(t.balance, t.symbol)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: theme.textPrimary, fontFamily: 'monospace' }}>{fmtUSD(t.usdValue)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: theme.textMuted }}>—</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button style={{ padding: '4px 12px', borderRadius: '6px', background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.25)', color: '#14b8a6', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Swap</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* LP Positions Tab */}
          {activeTab === 'lp' && (
            <div>
              {positions.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: theme.textMuted, fontSize: '13px' }}>No LP positions yet. Add liquidity to get started.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Pool', 'Hook', 'Liquidity', 'Fee Tier', 'Action'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Pool' ? 'left' : 'right', fontSize: '11px', fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${theme.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map(p => (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TokenPairIcon token1={p.token0} token2={p.token1} size={22} />
                            <span style={{ fontSize: '13px', fontWeight: '600', color: theme.textPrimary }}>{p.token0}/{p.token1}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: theme.textMuted }}>None</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: theme.textPrimary, fontFamily: 'monospace' }}>{fmtUSD(parseFloat(p.amount0 || '0') + parseFloat(p.amount1 || '0'))}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: theme.textMuted }}>{(p.fee_tier / 10000).toFixed(2)}%</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button onClick={() => onRemoveLiquidity?.({ token1: p.token0, token2: p.token1 })} style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Swap History Tab */}
          {activeTab === 'swaps' && (
            <div>
              {txns.filter(t => t.type === 'swap').length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: theme.textMuted, fontSize: '13px' }}>No swap history yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Time', 'Pair', 'Amount In', 'Amount Out', 'Tx'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Time' || h === 'Pair' ? 'left' : 'right', fontSize: '11px', fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${theme.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txns.filter(t => t.type === 'swap').map((t, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: '12px', fontSize: '12px', color: theme.textMuted }}>{fmtTime(t.timestamp)}</td>
                        <td style={{ padding: '12px', fontSize: '13px', color: theme.textPrimary }}>{t.token_in} → {t.token_out}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: theme.textSecondary, fontFamily: 'monospace' }}>{t.amount_in ? parseFloat(t.amount_in).toFixed(6) : '—'}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: theme.textSecondary, fontFamily: 'monospace' }}>{t.amount_out ? parseFloat(t.amount_out).toFixed(6) : '—'}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <a href={t.base_scan_url} target="_blank" rel="noopener noreferrer" style={{ color: '#14b8a6', fontSize: '12px', textDecoration: 'none' }}>Tx →</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Pool History Tab */}
          {activeTab === 'pools' && (
            <div>
              {txns.filter(t => t.type === 'add_liquidity' || t.type === 'remove_liquidity').length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: theme.textMuted, fontSize: '13px' }}>No pool history yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Time', 'Action', 'Pool', 'Amount', 'Tx'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Time' || h === 'Action' ? 'left' : 'right', fontSize: '11px', fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${theme.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txns.filter(t => t.type === 'add_liquidity' || t.type === 'remove_liquidity').map((t, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={{ padding: '12px', fontSize: '12px', color: theme.textMuted }}>{fmtTime(t.timestamp)}</td>
                        <td style={{ padding: '12px', fontSize: '13px', color: t.type === 'add_liquidity' ? '#10b981' : '#ef4444' }}>{t.type === 'add_liquidity' ? 'Added' : 'Removed'}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: theme.textPrimary }}>{t.token_in}/{t.token_out}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: theme.textSecondary, fontFamily: 'monospace' }}>{t.amount_in || '—'}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <a href={t.base_scan_url} target="_blank" rel="noopener noreferrer" style={{ color: '#14b8a6', fontSize: '12px', textDecoration: 'none' }}>Tx →</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Deposits Tab */}
          {activeTab === 'deposits' && (
            <div style={{ padding: '40px', textAlign: 'center', color: theme.textMuted, fontSize: '13px' }}>
              Deposit & withdrawal history will appear here once transactions are recorded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const RecentChatItem = ({ chat, theme, onDelete }) => {
  const [hovered, setHovered] = useState(false);
  
  const displayTitle = typeof chat === 'string' ? chat : chat.title;
  
  return (
    <button 
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        width: '100%', 
        padding: '8px 12px', 
        borderRadius: 6, 
        color: theme.textSecondary, 
        fontSize: 13, 
        cursor: 'pointer',
        textAlign: 'left',
        background: hovered ? theme.bgCard : 'transparent',
        border: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', flex: 1, minWidth: 0 }}>
        <MessageSquareIcon />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayTitle}</span>
      </div>
      {hovered && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            padding: 4,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 4,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = theme.bgPrimary; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'inherit'; e.currentTarget.style.background = 'transparent'; }}
        >
          <TrashIcon size={14} />
        </div>
      )}
    </button>
  );
};

// ============ THEMES ============
const themes = {
  light: {
    bgPrimary: '#ffffff',
    bgSecondary: '#f8f9fa',
    bgSidebar: '#ffffff',
    bgCard: '#ffffff',
    bgInput: '#ffffff',
    textPrimary: '#1a1a2e',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    border: '#e5e7eb',
    accent: '#a855f7',
    accentLight: '#f3e8ff',
  },
  dark: {
    bgPrimary: '#0B0E14', // Deep navy-black
    bgSecondary: '#13161F', // Slightly lighter for cards
    bgSidebar: '#0B0E14',
    bgCard: '#13161F',
    bgInput: '#0B0E14', // Darker for inputs
    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8', // Slate-400
    textMuted: '#64748B', // Slate-500
    border: 'rgba(255,255,255,0.06)',
    accent: '#8b5cf6',
    accentLight: 'rgba(139, 92, 246, 0.15)',
  }
};

// ============ SWAP COMPONENTS ============
const MiniChart = ({ data, color = "#10b981" }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 40;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} ${width},${height}`} fill="url(#chartGradient)"/>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};


// Token Select Modal
const TokenSelectModal = ({ isOpen, onClose, onSelect, theme, isDark, getTokenBalance, calculateUsdValue, selectingSide }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  if (!isOpen) return null;

  // Helper to abbreviate address for display
  const abbreviateAddress = (address: string) => {
    if (address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Use the actual token configuration from config/tokens.ts
  // Map tokens to include display properties
  const allTokens = ALL_TOKENS.map(token => ({
    symbol: token.symbol,
    name: token.name,
    address: token.address,
    displayAddress: abbreviateAddress(token.address),
    logoURI: token.logoURI,
    // Single-character fallback if logoURI fails to load
    icon: token.symbol === 'ETH' ? 'Ξ'
      : token.symbol === 'cbBTC' ? '₿'
      : token.symbol === 'USDC' ? '$'
      : token.symbol === 'EURC' ? '€'
      : token.symbol.charAt(0),
  }));

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'stablecoin', label: 'Stables' },
  ];

  // Filter tokens by category and search
  const STABLECOIN_SYMBOLS = new Set(['USDC', 'EURC']);
  const filteredTokens = allTokens.filter(token => {
    const isStable = STABLECOIN_SYMBOLS.has(token.symbol);
    const matchesCategory = selectedCategory === 'all' || (selectedCategory === 'stablecoin' && isStable);
    const matchesSearch = !searchQuery ||
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getTokenIcon = (token) => {
    const symbol = token.symbol;

    // Color mapping for canonical token set — used as fallback background
    const colorMap = {
      ETH:   'linear-gradient(135deg, #627EEA 0%, #8B9FFF 100%)',
      cbBTC: 'linear-gradient(135deg, #F7931A 0%, #FFB347 100%)',
      USDC:  'linear-gradient(135deg, #2775CA 0%, #4A9FE8 100%)',
      EURC:  'linear-gradient(135deg, #0052B4 0%, #2E86AB 100%)',
    };

    const background = colorMap[symbol] || 'linear-gradient(135deg, #627EEA 0%, #8B9FFF 100%)';
    const fallbackChar = token.icon || symbol.charAt(0);

    if (token.logoURI) {
      return (
        <div style={{ width: '40px', height: '40px', position: 'relative', flexShrink: 0 }}>
          <img
            src={token.logoURI}
            alt={symbol}
            width={40}
            height={40}
            style={{ borderRadius: '50%', display: 'block', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const sibling = e.currentTarget.nextElementSibling as HTMLElement;
              if (sibling) sibling.style.display = 'flex';
            }}
          />
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: '40px', height: '40px', borderRadius: '50%',
            background, display: 'none',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: '700', color: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>
            {fallbackChar}
          </div>
        </div>
      );
    }

    return (
      <div style={{
        width: '40px', height: '40px', borderRadius: '50%',
        background, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: '18px', fontWeight: '700', color: 'white',
        flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        {fallbackChar}
      </div>
    );
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(8px)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        maxHeight: '90vh',
        background: isDark ? '#13131a' : '#ffffff',
        borderRadius: '20px',
        border: `1px solid ${theme.border}`,
        boxShadow: '0 24px 48px -12px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: theme.textPrimary }}>{selectingSide === 'to' ? 'Select Token to Buy' : 'Select Token to Sell'}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: theme.textSecondary, padding: '4px' }}>
            <CloseIcon />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '0 24px 16px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', 
            borderRadius: '12px', 
            padding: '12px 16px',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'transparent'}`
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.textMuted} strokeWidth="2" style={{ marginRight: '10px' }}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="Search token" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{ 
                background: 'transparent', 
                border: 'none', 
                outline: 'none', 
                color: theme.textPrimary, 
                fontSize: '16px', 
                width: '100%' 
              }} 
            />
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: selectedCategory === cat.id 
                  ? 'linear-gradient(135deg, #a855f7, #9333ea)' 
                  : isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
                color: selectedCategory === cat.id ? '#fff' : theme.textSecondary,
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div style={{ height: '1px', background: theme.border, opacity: 0.5, marginBottom: '8px' }}></div>
        
        {/* Token List */}
        <div style={{ padding: '0 8px 16px', overflowY: 'auto', flex: 1 }}>
          {filteredTokens.length > 0 ? (
            filteredTokens.map(token => (
              <button
                key={token.symbol}
                onClick={() => { onSelect(token.symbol); onClose(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderRadius: '12px',
                  transition: 'background 0.2s',
                  marginBottom: '2px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {getTokenIcon(token)}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ color: theme.textPrimary, fontWeight: '600', fontSize: '16px' }}>{token.symbol}</span>
                      <span style={{ color: theme.textMuted, fontSize: '12px' }}>{token.name}</span>
                    </div>
                    <span style={{ color: theme.textSecondary, fontSize: '12px', fontFamily: 'SF Mono, Monaco, monospace' }}>{token.displayAddress}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  <span style={{ color: theme.textPrimary, fontWeight: '600', fontSize: '16px' }}>{getTokenBalance(token.symbol, token)}</span>
                  <span style={{ color: theme.textSecondary, fontSize: '13px' }}>${calculateUsdValue(getTokenBalance(token.symbol, token), token.symbol)}</span>
                </div>
              </button>
            ))
          ) : (
            <div style={{ padding: '32px', textAlign: 'center', color: theme.textSecondary }}>
              No tokens found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TokenSelect = ({ token, tokenData, balance, usdValue, side, amount, theme, onTokenClick, onAmountChange, livePrice, isPriceLoading, onPercentClick }) => {
  // Use tokenData if available, otherwise fall back to string-based logic
  const tokenSymbol = tokenData?.symbol || token;
  const tokenLogoURI = tokenData?.logoURI;

  return (
    <div style={{
      background: theme ? theme.bgSecondary : 'rgba(249, 250, 251, 0.8)',
      borderRadius: '16px',
      padding: '16px',
      border: theme ? `1px solid ${theme.border}` : '1px solid rgba(139, 92, 246, 0.1)',
      marginBottom: '4px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: onPercentClick ? '8px' : '12px' }}>
        <span style={{ color: theme ? theme.textSecondary : '#6b7280', fontSize: '14px', fontWeight: '500' }}>{side}</span>
        <span style={{ color: theme ? theme.textMuted : '#9ca3af', fontSize: '13px' }}>Balance: {balance || '0.00'}</span>
      </div>

      {/* Percentage shortcut buttons — Sell side only */}
      {onPercentClick && (
        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
          {[25, 50, 75].map(pct => (
            <button
              key={pct}
              onClick={() => onPercentClick(pct / 100)}
              style={{
                flex: 1,
                padding: '4px 0',
                borderRadius: '6px',
                border: `1px solid ${theme?.border || 'rgba(139,92,246,0.2)'}`,
                background: 'transparent',
                color: theme?.textSecondary || '#9ca3af',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {pct}%
            </button>
          ))}
          <button
            onClick={() => onPercentClick(1)}
            style={{
              flex: 1,
              padding: '4px 0',
              borderRadius: '6px',
              border: `1px solid ${theme?.accent || '#8b5cf6'}`,
              background: `${theme?.accent || '#8b5cf6'}15`,
              color: theme?.accent || '#8b5cf6',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Max
          </button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <input
            type="text"
            value={amount}
            onChange={(e) => onAmountChange && onAmountChange(e.target.value)}
            placeholder="0.00"
            style={{
              background: 'transparent',
              border: 'none',
              color: theme ? theme.textPrimary : '#111827',
              fontSize: '32px',
              fontWeight: '600',
              width: '100%',
              outline: 'none',
              fontFamily: 'SF Mono, Monaco, monospace',
              marginBottom: '4px'
            }}
          />
          <div style={{ color: theme ? theme.textMuted : '#9ca3af', fontSize: '13px' }}>≈ ${usdValue || '0.00'}</div>
        </div>
        <button
          onClick={onTokenClick}
          style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: '9999px',
          border: theme?.mode === 'dark' ? '1px solid #4b5563' : '1px solid #e5e7eb',
          background: theme?.mode === 'dark' ? '#1f2937' : '#f3f4f6',
          color: theme?.mode === 'dark' ? '#f3f4f6' : '#1f2937',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: '600',
          flexShrink: 0,
          transition: 'background 0.2s ease',
        }}>
          {tokenLogoURI ? (
            <img
              src={tokenLogoURI}
              alt={tokenSymbol}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: tokenSymbol.includes('ETH')
              ? 'linear-gradient(135deg, #627EEA 0%, #8B9FFF 100%)'
              : tokenSymbol.includes('USD')
                ? 'linear-gradient(135deg, #2775CA 0%, #4A9FE8 100%)'
                : tokenSymbol.includes('BTC')
                  ? 'linear-gradient(135deg, #F7931A 0%, #FFAB4A 100%)'
                  : tokenSymbol.includes('SOL')
                    ? 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)'
                    : 'linear-gradient(135deg, #9ca3af 0%, #d1d5db 100%)',
            display: tokenLogoURI ? 'none' : 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: '700',
            color: 'white',
          }}>
            {tokenSymbol.includes('ETH') ? 'Ξ' :
             tokenSymbol.includes('USD') ? '$' :
             tokenSymbol.includes('BTC') ? '₿' :
             tokenSymbol.includes('SOL') ? '◎' : '◆'}
          </div>
          {tokenSymbol || 'Select'}
          <ChevronDownIcon />
        </button>
      </div>

      {/* Token Price Display */}
      <div style={{
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: theme ? `1px solid ${theme.border}` : '1px solid rgba(139, 92, 246, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{
          color: theme ? theme.textMuted : '#9ca3af',
          fontSize: '12px',
          fontWeight: '500'
        }}>
          Current Price
        </span>
        <span style={{
          color: theme ? theme.textSecondary : '#6b7280',
          fontSize: '13px',
          fontWeight: '600'
        }}>
          {isPriceLoading ? '—' : livePrice !== null && livePrice !== undefined ? `$${livePrice < 0.01 ? livePrice.toFixed(6) : livePrice < 1 ? livePrice.toFixed(4) : livePrice.toFixed(2)}` : 'unavailable'}
        </span>
      </div>
    </div>
  );
};

// Hook Selector Modal
const HookSelectorModal = ({ isOpen, onClose, hooks, selectedHook, onSelect, theme, isDark }) => {
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
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Select Swap Hook</h3>
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
                  For most swaps, <span style={{ fontWeight: '600', color: '#6b7280' }}>No Hook</span> provides standard Uniswap v4 constant-product execution.
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
                    ? `2px solid #8b5cf6` 
                    : `1px solid ${theme.border}`,
                  background: selectedHook === hook.id 
                    ? (isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)') 
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
                  background: selectedHook === hook.id ? 'rgba(139, 92, 246, 0.2)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: selectedHook === hook.id ? '#8b5cf6' : theme.textSecondary,
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
                      <div style={{ fontSize: '14px', fontWeight: '500', color: theme.textPrimary }}>No Hook</div>
                      <div style={{ fontSize: '12px', color: theme.textSecondary, fontFamily: 'monospace' }}>0x1234...5678</div>
                    </div>
                    <div style={{ fontSize: '12px', color: theme.textMuted }}>2 days ago</div>
                  </div>
                  
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
                      <div style={{ fontSize: '14px', fontWeight: '500', color: theme.textPrimary }}>Custom Fee Hook</div>
                      <div style={{ fontSize: '12px', color: theme.textSecondary, fontFamily: 'monospace' }}>0xabcd...efgh</div>
                    </div>
                    <div style={{ fontSize: '12px', color: theme.textMuted }}>1 week ago</div>
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

// ============ SWAP INTERFACE ============
const SwapInterface = ({ onClose, swapDetails, theme, isDark, onActionComplete = null }) => {
  const { isConnected, address } = useAccount();
  const currentChainId = useChainId();
  const { openModal } = useWalletConnection();
  const [selectedHook, setSelectedHook] = useState(swapDetails?.hook || 'none');
  const [isHookModalOpen, setIsHookModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState(0.5);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 900);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // State for token selector
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false);
  const [selectingSide, setSelectingSide] = useState(null); // 'from' or 'to'
  
  // Swap state
  const [fromToken, setFromToken] = useState(swapDetails?.fromToken || "ETH");
  const [toToken, setToToken] = useState(swapDetails?.toToken || "USDC");
  const [fromAmount, setFromAmount] = useState(swapDetails?.fromAmount || "");
  const [toAmount, setToAmount] = useState(swapDetails?.toAmount || "");

  // Find token data from ALL_TOKENS
  const fromTokenData = useMemo(() => {
    return ALL_TOKENS.find(t => t.symbol === fromToken) || NATIVE_ETH;
  }, [fromToken]);

  const toTokenData = useMemo(() => {
    return ALL_TOKENS.find(t => t.symbol === toToken) || ALL_TOKENS[1];
  }, [toToken]);

  // Parse amount for hooks
  const parsedAmount = useMemo(() => {
    try {
      return parseTokenAmount(fromAmount || '0', fromTokenData.decimals);
    } catch {
      return BigInt(0);
    }
  }, [fromAmount, fromTokenData.decimals]);

  // Token approval hook
  const {
    status: approvalStatus,
    needsApproval,
    isApproved,
    approve,
    error: approvalError,
  } = useTokenApproval({
    tokenAddress: fromTokenData.address,
    amount: parsedAmount,
    enabled: isConnected && parsedAmount > BigInt(0),
  });

  // Swap quote hook
  const { quote, isLoading: isQuoteLoading } = useSwapQuote({
    tokenIn: fromTokenData.address,
    tokenOut: toTokenData.address,
    amountIn: fromAmount,
    inputDecimals: fromTokenData.decimals,
    outputDecimals: toTokenData.decimals,
    slippageTolerance,
    hookAddress: getHookAddress(selectedHook),
    feeTier: 500, // 0.05% fee tier — matches the ETH/USDC pool on Base Sepolia
    enabled: parsedAmount > BigInt(0),
  });

  // Swap execution hook
  const {
    status: swapStatus,
    txHash,
    error: swapError,
    isExecuting,
    execute: executeSwap,
    retry: retrySwap,
    reset: resetSwap,
  } = useSwapExecution();

  // Token balances hook (for ERC-20 tokens)
  const { balancesBySymbol, refetch: refetchTokenBalances } = useTokenBalances();

  // Native ETH balance hook
  const { data: ethBalance, refetch: refetchEthBalance } = useBalance({
    address: address,
    query: {
      enabled: !!address,
      staleTime: 10_000, // 10 seconds
      refetchInterval: 30_000, // Refetch every 30 seconds
    },
  });

  // Helper function to get balance for any token
  const getTokenBalance = (tokenSymbol: string, tokenData: any) => {
    // Check if it's native ETH
    if (tokenSymbol === 'ETH' || isNativeEth(tokenData.address)) {
      return ethBalance?.formatted || '0.00';
    }
    // Otherwise lookup in ERC-20 balances
    return balancesBySymbol[tokenSymbol]?.formatted || balancesBySymbol[tokenData.symbol]?.formatted || '0.00';
  };

  // Helper function to calculate USD value using centralized price service
  const calculateUsdValue = (amount: string, tokenSymbol: string) => {
    return calcUsdValue(amount, tokenSymbol);
  };

  // Live CoinGecko prices for from/to tokens and pair rate
  const { price: fromTokenLivePrice, isLoading: fromPriceLoading } = useLivePriceUSD(fromToken);
  const { price: toTokenLivePrice, isLoading: toPriceLoading } = useLivePriceUSD(toToken);
  const { rate: livePairRate, isLoading: rateLoading } = useLivePairRate(fromToken, toToken);

  // Update toAmount when quote changes
  useEffect(() => {
    if (quote && quote.outputAmount > BigInt(0)) {
      setToAmount(formatTokenAmount(quote.outputAmount, toTokenData.decimals, toTokenData.symbol === 'USDC' || toTokenData.symbol === 'EURC'));
    } else if (!fromAmount) {
      setToAmount('');
    }
  }, [quote, fromAmount, toTokenData.decimals]);
  
  // Update local state when props change
  useEffect(() => {
     if (swapDetails) {
        setFromToken(swapDetails.fromToken || "ETH");
        setToToken(swapDetails.toToken || "USDC");
        setFromAmount(swapDetails.fromAmount || "");
        setToAmount(swapDetails.toAmount || "");
     }
  }, [swapDetails]);

  // Save confirmed swap to portfolio_transactions DB and update chat title
  useEffect(() => {
    if (swapStatus === 'confirmed' && txHash && address && fromToken && toToken && fromAmount) {
      fetch('/api/portfolio/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          type: 'swap',
          txHash,
          tokenIn: fromToken,
          tokenOut: toToken,
          amountIn: fromAmount,
          amountOut: toAmount || '',
          chainId: currentChainId,
        }),
      }).catch(err => console.warn('[Portfolio] Failed to record swap transaction:', err));
      if (onActionComplete) {
        onActionComplete(`Swap ${fromAmount} ${fromToken} → ${toToken}`);
      }
    }
  }, [swapStatus, txHash]);

  const handleSwap = async () => {
    if (!isConnected || !quote) return;

    const params = {
      tokenIn: fromTokenData.address as `0x${string}`,
      tokenOut: toTokenData.address as `0x${string}`,
      amountIn: parsedAmount,
      hookAddress: getHookAddress(selectedHook),
      hookId: selectedHook,
      feeTier: 500, // must match the fee tier of the active ETH/USDC pool
    };

    try {
      // approve() now awaits on-chain confirmation before returning
      if (needsApproval) {
        await approve(true);
      }
      setShowConfirmation(true);
      await executeSwap(params);
    } catch {
      // Errors set inside approve() / executeSwap() and surfaced via approvalError / swapError
    }
  };

  const handleCloseConfirmation = () => {
    setShowConfirmation(false);
    if (swapStatus === 'confirmed') {
      setFromAmount('');
      setToAmount('');
      resetSwap();
    }
  };

  // Percentage-of-balance shortcut for the Sell input
  const handlePercentage = (pct: number) => {
    let rawBigInt: bigint | undefined;
    const decimals = fromTokenData.decimals;

    if (fromToken === 'ETH' || isNativeEth(fromTokenData.address)) {
      rawBigInt = ethBalance?.value;
    } else {
      const entry = balancesBySymbol[fromToken] || balancesBySymbol[fromTokenData.symbol];
      rawBigInt = entry?.balance;
    }

    if (!rawBigInt || rawBigInt <= 0n) return;

    const pctMap: Record<number, [bigint, bigint]> = { 0.25: [1n, 4n], 0.5: [1n, 2n], 0.75: [3n, 4n], 1: [1n, 1n] };
    const [num, den] = pctMap[pct] ?? [BigInt(Math.round(pct * 10000)), 10000n];
    const scaledAmount = rawBigInt * num / den;

    const divisor = 10n ** BigInt(decimals);
    const wholePart = scaledAmount / divisor;
    const fracPart = scaledAmount % divisor;
    const maxDecimals = Math.min(decimals, 8);
    const fracStr = fracPart.toString().padStart(decimals, '0').slice(0, maxDecimals).replace(/0+$/, '');
    const result = fracStr ? `${wholePart}.${fracStr}` : `${wholePart}`;
    setFromAmount(result || '0');
  };

  // Swap the from/to tokens and amounts
  const handleFlipTokens = () => {
    const tmpToken = fromToken;
    const tmpAmount = fromAmount;
    setFromToken(toToken);
    setToToken(tmpToken);
    setFromAmount(toAmount);
    setToAmount(tmpAmount);
  };

  const handleTokenSelect = (tokenSymbol) => {
    if (selectingSide === 'from') {
        setFromToken(tokenSymbol);
        setFromAmount('');
        setToAmount('');
    } else {
        setToToken(tokenSymbol);
        // Keep fromAmount so quote can recalculate with new token
        setToAmount('');
    }
    setIsTokenSelectorOpen(false);
  };

  const openTokenSelector = (side) => {
    setSelectingSide(side);
    setIsTokenSelectorOpen(true);
  };

  const hooks = [
    { id: 'none', name: 'No Hook', description: 'Standard Uniswap v4 swap without modifications', icon: <SwapIcon /> },
  ];

  useEffect(() => {
    if (swapDetails?.hook) {
        // Find if hook name matches
        const hookId = hooks.find(h => h.name.toLowerCase().includes(swapDetails.hook.toLowerCase()) || h.id.toLowerCase() === swapDetails.hook.toLowerCase())?.id;
        if (hookId) setSelectedHook(hookId);
        else if (swapDetails.hook.toLowerCase().includes('custom')) setSelectedHook('custom');
    }
  }, [swapDetails]);

  const getSelectedHookObj = () => {
    return hooks.find(h => h.id === selectedHook) || hooks[1]; // Default to No Hook if not found
  };

  const selectedHookObj = getSelectedHookObj();

  return (
    <div style={{
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto',
      position: 'relative',
      fontFamily: '"DM Sans", sans-serif',
    }}>

      {/* Hook Selector Modal */}
      <HookSelectorModal
        isOpen={isHookModalOpen}
        onClose={() => setIsHookModalOpen(false)}
        hooks={hooks}
        selectedHook={selectedHook}
        onSelect={setSelectedHook}
        theme={theme}
        isDark={isDark}
      />

      {/* Token Selector Modal */}
      <TokenSelectModal
        isOpen={isTokenSelectorOpen}
        onClose={() => setIsTokenSelectorOpen(false)}
        onSelect={handleTokenSelect}
        theme={theme}
        isDark={isDark}
        getTokenBalance={getTokenBalance}
        calculateUsdValue={calculateUsdValue}
        selectingSide={selectingSide}
      />

      {/* AI Response Banner */}
      {swapDetails && (
        <div style={{
          marginBottom: '24px',
          padding: '16px 20px',
          background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
          }}>
            <span style={{ fontSize: '18px' }}>✨</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: theme.textPrimary, fontWeight: '600', fontSize: '15px', marginBottom: '2px' }}>
              Swapping {swapDetails.fromAmount} {swapDetails.fromToken} → {swapDetails.toToken}
            </div>
            <div style={{ color: theme.textSecondary, fontSize: '13px' }}>
              Executing via pure Uniswap v4 (no hook)
            </div>
          </div>
        </div>
      )}

      {/* Main Flex Container */}
      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        gap: '20px',
        width: '100%',
      }}>
        
        {/* LEFT COLUMN: Chart Panel */}
        <div style={{ 
          flex: '1.5',
          minWidth: isMobile ? '100%' : '500px',
          background: theme.bgCard,
          borderRadius: '16px',
          border: `1px solid ${theme.border}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          padding: '24px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <TokenPairIcon token1={fromToken} token2={toToken} size={28} />
              <span style={{ color: theme.textPrimary, fontWeight: '700', fontSize: '16px' }}>{fromToken} / {toToken}</span>
            </div>

            <div style={{ flex: 1, minHeight: '320px' }}>
              <SwapPriceChart
                fromToken={fromToken}
                toToken={toToken}
                theme={theme}
                isDark={isDark}
              />
            </div>
        </div>

        {/* RIGHT COLUMN: Swap Form */}
        <div style={{
          width: isMobile ? '100%' : '400px',
          flexShrink: 0,
          background: theme.bgCard,
          borderRadius: '16px',
          padding: '24px',
          border: `1px solid ${theme.border}`,
          boxShadow: isDark ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ color: theme.textPrimary, fontSize: '20px', fontWeight: '700', margin: 0, letterSpacing: '-0.02em' }}>Swap</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: theme.textMuted, cursor: 'pointer', padding: '8px', borderRadius: '50%' }}>
                <CloseIcon />
              </button>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <TokenSelect
              token={fromToken}
              tokenData={fromTokenData}
              balance={getTokenBalance(fromToken, fromTokenData)}
              usdValue={calculateUsdValue(fromAmount, fromToken)}
              side="Sell"
              amount={fromAmount}
              theme={theme}
              onTokenClick={() => openTokenSelector('from')}
              onAmountChange={(val) => setFromAmount(val)}
              livePrice={fromTokenLivePrice}
              isPriceLoading={fromPriceLoading}
              onPercentClick={handlePercentage}
            />
            
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10
            }}>
              <button
                onClick={handleFlipTokens}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: `4px solid ${theme.bgCard}`,
                  background: theme.bgSecondary,
                  color: theme.accent,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                }}
              >
                <ArrowLeftRightIcon />
              </button>
            </div>

            <TokenSelect
              token={toToken}
              tokenData={toTokenData}
              balance={getTokenBalance(toToken, toTokenData)}
              usdValue={calculateUsdValue(toAmount, toToken)}
              side="Buy"
              amount={toAmount}
              theme={theme}
              onTokenClick={() => openTokenSelector('to')}
              livePrice={toTokenLivePrice}
              isPriceLoading={toPriceLoading}
            />
          </div>

          {/* Hook Selection - Inline Preview */}
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: theme.textSecondary, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Swap Hook</span>
            </div>

            <button 
              onClick={() => setIsHookModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '12px 16px',
                borderRadius: '16px',
                border: `1px solid ${theme.border}`,
                background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: `${theme.accent}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.accent,
                }}>
                  {selectedHookObj.icon}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: theme.textPrimary, fontWeight: '700', fontSize: '15px' }}>{selectedHookObj.name}</div>
                  <div style={{ color: '#10b981', fontSize: '13px', fontWeight: '500' }}>
                    {selectedHookObj.benefit ? `+${selectedHookObj.benefit}` : 'Standard execution'}
                  </div>
                </div>
              </div>
              <div style={{ color: theme.accent, fontWeight: '600', fontSize: '13px' }}>
                Change
              </div>
            </button>
          </div>

          {/* Swap Details Breakdown */}
          {(() => {
            const LP_FEE_PCT    = 0.0005; // matches feeTier: 500 (0.05%)
            const HOOK_FEE_PCT  = selectedHook !== 'none' ? 0.01 : 0;
            const TOTAL_FEE_PCT = LP_FEE_PCT + HOOK_FEE_PCT;
            const rateInclFees  = livePairRate !== null
              ? livePairRate * (1 - TOTAL_FEE_PCT / 100)
              : null;
            const fmtRate = (r) => r < 0.001 ? r.toExponential(3) : r < 1 ? r.toFixed(6) : r >= 1000 ? r.toLocaleString(undefined, { maximumFractionDigits: 2 }) : r.toFixed(4);
            const priceImpact  = quote ? quote.priceImpact : null;
            const impactColor  = priceImpact === null ? '#10b981' : priceImpact < 1 ? '#10b981' : priceImpact < 5 ? '#f59e0b' : '#ef4444';
            const fmtImpact = (v) => v < 0.01 ? `${v.toFixed(4)}%` : `${v.toFixed(2)}%`;

            // Pool routing label based on token pair + hook
            const STABLES = ['USDC', 'USDT', 'USDE', 'USDS'];
            const normA = fromToken.replace(/^m/, '').toUpperCase();
            const normB = toToken.replace(/^m/, '').toUpperCase();
            const aIsStable = STABLES.includes(normA);
            const bIsStable = STABLES.includes(normB);
            const poolRoute = normA === 'ETH' || normB === 'ETH'
              ? `ETH/${normA === 'ETH' ? normB : normA} CorePool`
              : `${normA}/${normB} CorePool`;

            return (
              <div style={{ marginTop: '12px' }}>

                {/* Exchange Rate — standalone, only for the active pair */}
                {!rateLoading && rateInclFees !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '8px 12px', background: `${theme.accent}10`, borderRadius: '10px', border: `1px solid ${theme.accent}20` }}>
                    <span style={{ color: theme.textSecondary, fontSize: '12px', fontWeight: '600' }}>Exchange Rate (Incl. Fees)</span>
                    <span style={{ color: theme.textPrimary, fontSize: '13px', fontWeight: '600' }}>
                      1 {fromToken} = {fmtRate(rateInclFees)} {toToken}
                    </span>
                  </div>
                )}

                {/* Fee + Stats card */}
                <div style={{ padding: '12px 16px', background: theme.bgSecondary, borderRadius: '16px' }}>
                  {/* Fee Architecture */}
                  <div style={{ color: theme.textSecondary, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Fee Architecture</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                    <span style={{ color: theme.textMuted }}>LP Fee</span>
                    <span style={{ color: theme.textPrimary }}>0.0025%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: theme.textMuted }}>Hook Fee</span>
                    <span style={{ color: theme.textPrimary }}>{HOOK_FEE_PCT === 0 ? '0.00' : HOOK_FEE_PCT.toFixed(2)}%</span>
                  </div>

                  {/* Swap Stats */}
                  <div style={{ borderTop: `1px solid ${theme.border}`, marginTop: '8px', paddingTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                      <span style={{ color: theme.textSecondary }}>Price Impact</span>
                      <span style={{ color: impactColor, fontWeight: priceImpact !== null && priceImpact >= 5 ? '700' : '500' }}>
                        {priceImpact !== null ? fmtImpact(priceImpact) : '<0.01%'}
                        {priceImpact !== null && priceImpact >= 5 && ' ⚠️'}
                      </span>
                    </div>

                    {/* Max Slippage — editable number scroll */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '13px' }}>
                      <span style={{ color: theme.textSecondary }}>Max Slippage</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          onClick={() => setSlippageTolerance(v => Math.max(0.1, parseFloat((v - 0.1).toFixed(1))))}
                          style={{ width: '20px', height: '20px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textSecondary, cursor: 'pointer', fontSize: '14px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                        >−</button>
                        <input
                          type="number"
                          min="0.1"
                          max="50"
                          step="0.1"
                          value={slippageTolerance}
                          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0.1 && v <= 50) setSlippageTolerance(parseFloat(v.toFixed(1))); }}
                          style={{ width: '40px', textAlign: 'center', background: 'transparent', border: 'none', color: theme.textPrimary, fontSize: '13px', fontWeight: '600', outline: 'none', padding: 0 }}
                        />
                        <span style={{ color: theme.textMuted, fontSize: '13px' }}>%</span>
                        <button
                          onClick={() => setSlippageTolerance(v => Math.min(50, parseFloat((v + 0.1).toFixed(1))))}
                          style={{ width: '20px', height: '20px', borderRadius: '4px', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textSecondary, cursor: 'pointer', fontSize: '14px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                        >+</button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                      <span style={{ color: theme.textSecondary }}>Min. Received</span>
                      <span style={{ color: theme.textPrimary }}>
                        {quote ? `${formatTokenAmount(quote.minimumReceived, toTokenData.decimals, toTokenData.category === 'stablecoin')} ${toToken}` : '-'}
                      </span>
                    </div>

                    {/* Trade route */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', marginBottom: selectedHook !== 'none' ? '6px' : 0 }}>
                      <span style={{ color: theme.textSecondary }}>Trade Routed Through</span>
                      <span style={{ color: theme.accent, fontWeight: '600', fontSize: '12px' }}>{poolRoute}</span>
                    </div>

                    {selectedHook !== 'none' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: theme.textSecondary }}>Hook</span>
                        <span style={{ color: '#10b981', fontWeight: '700' }}>Active</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Swap Button with approval/execution states */}
          <SwapButtonStyles />
          <div style={{ marginTop: '12px' }}>
            <SwapButton
              isConnected={isConnected}
              hasAmount={parsedAmount > BigInt(0)}
              hasTokens={!!fromToken && !!toToken}
              approvalStatus={approvalStatus}
              swapStatus={swapStatus}
              tokenSymbol={fromToken}
              priceImpact={quote?.priceImpact || 0}
              onConnect={openModal}
              onApprove={handleSwap}
              onSwap={handleSwap}
              disabled={isExecuting || !quote || (approvalStatus === 'approving')}
              theme={theme}
              isDark={isDark}
            />
          </div>

          {/* Approval/Error Status */}
          {approvalError && (
            <div style={{ 
              marginTop: '8px', 
              padding: '10px 12px', 
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
              fontSize: '13px'
            }}>
              {approvalError.message}
            </div>
          )}

          {swapError && (
            <div style={{
              marginTop: '8px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
              fontSize: '13px'
            }}>
              {swapError.message}
            </div>
          )}

          {swapStatus === 'confirmed' && txHash && (
            <div style={{
              marginTop: '8px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span>Swap confirmed!</span>
              <a
                href={getExplorerLink(txHash, currentChainId)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#10b981', textDecoration: 'underline', fontWeight: 600 }}
              >
                View on explorer
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Swap Confirmation Modal */}
      {showConfirmation && (swapStatus === 'pending' || swapStatus === 'confirming' || swapStatus === 'confirmed' || swapStatus === 'failed') && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{ maxWidth: '400px', width: '90%' }}>
            <SwapConfirmation
              status={swapStatus}
              txHash={txHash}
              error={swapError}
              inputAmount={fromAmount}
              outputAmount={toAmount}
              inputSymbol={fromToken}
              outputSymbol={toToken}
              onRetry={retrySwap}
              onClose={handleCloseConfirmation}
              chainId={currentChainId}
              theme={theme}
              isDark={isDark}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ============ LIQUIDITY INTERFACE ============
const LiquidityInterface = ({ onClose, theme, isDark, onAddLiquidity, onCreatePool }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHookFilter, setSelectedHookFilter] = useState('All');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('All');
  const [sort, setSort] = useState({ key: 'liquidity', direction: 'desc' });
  const currentChainId = useChainId();

  const [dbPools, setDbPools] = React.useState([]);
  React.useEffect(() => {
    fetch(`/api/portfolio?chainId=${currentChainId}`).then(r => r.ok ? r.json() : []).then(rows => setDbPools(rows ?? [])).catch(() => {});
  }, [currentChainId]);

  // Merge DB pools with display-friendly format
  const pools = dbPools.length > 0 ? dbPools.map(p => ({
    token1: p.token0, token2: p.token1,
    type: p.hook_address && p.hook_address !== '0x0000000000000000000000000000000000000000' ? 'Stable' : 'Standard',
    hook: p.hook_address && p.hook_address !== '0x0000000000000000000000000000000000000000' ? 'Stable Protection' : 'None',
    hookAddress: p.hook_address,
    volume: 0, fees: 0, liquidity: 0, yield: '0.00',
    txHash: p.tx_hash, feeTier: p.fee_tier,
    chainId: p.chain_id,
  })) : [];

  const hookOptions = ['All', 'None'];
  const typeOptions = ['All', 'Standard', 'Stable'];

  // Filter and sort pools
  const filteredPools = pools
    .filter(pool => {
      const matchesSearch = searchQuery === '' || 
        `${pool.token1} ${pool.token2}`.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesHook = selectedHookFilter === 'All' || pool.hook === selectedHookFilter;
      const matchesType = selectedTypeFilter === 'All' || pool.type === selectedTypeFilter;
      return matchesSearch && matchesHook && matchesType;
    })
    .sort((a, b) => {
      const multiplier = sort.direction === 'asc' ? 1 : -1;
      if (sort.key === 'yield') {
        return (parseFloat(a.yield) - parseFloat(b.yield)) * multiplier;
      }
      return (a[sort.key] - b[sort.key]) * multiplier;
    });

  const handleSort = (key) => {
    setSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Helper components for Liquidity Interface
  const SortableHeader = ({ label, sortKey, currentSort, onSort }) => {
    const isActive = currentSort.key === sortKey;
    const isAsc = currentSort.direction === 'asc';
  
    return (
      <button
        onClick={() => onSort(sortKey)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'transparent',
          border: 'none',
          color: isActive ? theme.accent : theme.textSecondary,
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
          padding: '0',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {label}
        <span style={{ opacity: isActive ? 1 : 0.3 }}>
          {isActive && isAsc ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </span>
      </button>
    );
  };

  const HookBadge = ({ hook }) => {
    const hookConfig = {
      'None': { icon: null, color: theme.textSecondary, bg: theme.bgSecondary },
    };
    const config = hookConfig[hook] || hookConfig['None'];
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 6px', borderRadius: '4px', background: config.bg, color: config.color, fontSize: '10px', fontWeight: '600', whiteSpace: 'nowrap' }}>
        {config.icon && <span style={{ transform: 'scale(0.8)' }}>{config.icon}</span>}
        {hook}
      </div>
    );
  };

  const PoolTypeBadge = ({ type }) => {
    const isStable = type === 'Stable';
    return (
      <span style={{ padding: '2px 6px', borderRadius: '4px', background: isStable ? 'rgba(16, 185, 129, 0.1)' : theme.bgSecondary, color: isStable ? '#10b981' : theme.textSecondary, fontSize: '10px', fontWeight: '600' }}>
        {type}
      </span>
    );
  };

  const YieldBadge = ({ value }) => {
    const numValue = parseFloat(value);
    const isPositive = numValue > 0;
    return (
      <span style={{ padding: '4px 10px', borderRadius: '6px', background: isPositive ? 'rgba(16, 185, 129, 0.15)' : theme.bgSecondary, color: isPositive ? '#10b981' : theme.textSecondary, fontSize: '13px', fontWeight: '600' }}>
        {value}%
      </span>
    );
  };


  const StatsCard = ({ label, value, change }) => (
    <div style={{ background: theme.bgCard, borderRadius: '12px', padding: '20px', border: `1px solid ${theme.border}`, flex: 1 }}>
      <div style={{ color: theme.textSecondary, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{label}</div>
      <div style={{ color: theme.textPrimary, fontSize: '24px', fontWeight: '700', fontFamily: 'SF Mono, Monaco, monospace' }}>{value}</div>
      {change && <div style={{ color: change.startsWith('+') ? '#10b981' : '#ef4444', fontSize: '12px', fontWeight: '500', marginTop: '4px' }}>{change} vs last week</div>}
    </div>
  );

  // Calculate totals
  const totalTVL = pools.reduce((sum, p) => sum + p.liquidity, 0);
  const totalVolume = pools.reduce((sum, p) => sum + p.volume, 0);
  const totalFees = pools.reduce((sum, p) => sum + p.fees, 0);

  return (
    <div style={{ width: '100%', fontFamily: '"DM Sans", sans-serif' }}>
      {/* AI Response Banner */}
      <div style={{
        marginBottom: '24px',
        padding: '16px 20px',
        background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)' }}>
          <span style={{ fontSize: '16px' }}>✨</span>
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ color: theme.textSecondary, fontSize: '14px', lineHeight: '1.5' }}>
            <span style={{ color: theme.accent, fontWeight: '600' }}>{filteredPools.length > 0 ? `${filteredPools.length} pools on ${currentChainId === 1301 ? 'Unichain Sepolia' : 'Base Sepolia'}` : 'No pools yet — create your first pool'}</span>
            {' '}• ETH, USDC, EURC on Uniswap v4.
          </span>
        </div>
      </div>

      <div style={{ background: theme.bgCard, borderRadius: '24px', border: `1px solid ${theme.border}`, padding: '24px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h1 style={{ color: theme.textPrimary, fontSize: '24px', fontWeight: '700', margin: '0 0 4px 0' }}>Liquidity Pools</h1>
            <p style={{ color: theme.textSecondary, fontSize: '14px', margin: 0 }}>Explore and manage your liquidity positions.</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: theme.textMuted, cursor: 'pointer', padding: '8px', borderRadius: '50%' }}>
            <CloseIcon />
          </button>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <StatsCard label="TVL" value={`$${totalTVL.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} change={null} />
          <StatsCard label="Volume 24h" value={`$${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} change={null} />
          <StatsCard label="Fees 24h" value={`$${totalFees.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} change={null} />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
           <div style={{ position: 'relative', flex: 1 }}>
            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted }}>
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Search pools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '12px', border: `1px solid ${theme.border}`, background: theme.bgSecondary, color: theme.textPrimary, fontSize: '14px', outline: 'none' }}
            />
          </div>
          
          <select
              value={selectedHookFilter}
              onChange={(e) => setSelectedHookFilter(e.target.value)}
              style={{ padding: '10px 32px 10px 12px', borderRadius: '12px', border: `1px solid ${theme.border}`, background: theme.bgSecondary, color: theme.textPrimary, fontSize: '13px', fontWeight: '500', cursor: 'pointer', outline: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
            >
              {hookOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          <button onClick={onCreatePool} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)' }}>
            <PlusIcon /> Create Pool
          </button>
        </div>

        {/* Pools Table */}
        <div style={{ border: `1px solid ${theme.border}`, borderRadius: '16px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}`, background: theme.bgSecondary }}>
                <th style={{ padding: '14px 12px', textAlign: 'left', color: theme.textSecondary, fontSize: '13px', fontWeight: '600', width: '280px' }}>Pool <span style={{ opacity: 0.4, fontSize: '11px', marginLeft: '4px' }}>↕</span></th>
                <th style={{ padding: '14px 12px', textAlign: 'left', width: '100px' }}><SortableHeader label="Vol(24h)" sortKey="volume" currentSort={sort} onSort={handleSort} /></th>
                <th style={{ padding: '14px 12px', textAlign: 'left', width: '80px' }}><SortableHeader label="Fees" sortKey="fees" currentSort={sort} onSort={handleSort} /></th>
                <th style={{ padding: '14px 12px', textAlign: 'left', width: '120px' }}><SortableHeader label="Liquidity" sortKey="liquidity" currentSort={sort} onSort={handleSort} /></th>
                <th style={{ padding: '14px 12px', textAlign: 'left', width: '80px' }}><SortableHeader label="Yield" sortKey="yield" currentSort={sort} onSort={handleSort} /></th>
                <th style={{ padding: '14px 12px', textAlign: 'left', width: '130px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredPools.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: theme.textMuted, fontSize: '14px' }}>
                  <div style={{ marginBottom: '8px', fontSize: '32px' }}>🌊</div>
                  No pools yet. Create your first pool →
                </td></tr>
              ) : filteredPools.map((pool, i) => (
                <tr key={i} style={{ borderBottom: i === filteredPools.length - 1 ? 'none' : `1px solid ${theme.border}` }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <TokenPairIcon token1={pool.token1} token2={pool.token2} size={24} />
                      <div>
                        <div style={{ color: theme.textPrimary, fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>{pool.token1} / {pool.token2}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          <PoolTypeBadge type={pool.type} />
                          {pool.feeTier && <span style={{ padding: '2px 6px', borderRadius: '4px', background: theme.bgSecondary, color: theme.textSecondary, fontSize: '10px', fontWeight: '600' }}>{(pool.feeTier/10000).toFixed(2)}%</span>}
                          <HookBadge hook={pool.hook} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}><span style={{ color: theme.textPrimary, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '13px' }}>${pool.volume.toLocaleString()}</span></td>
                  <td style={{ padding: '12px' }}><span style={{ color: theme.textPrimary, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '13px' }}>${pool.fees.toLocaleString()}</span></td>
                  <td style={{ padding: '12px' }}><span style={{ color: theme.textPrimary, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '13px' }}>${pool.liquidity.toLocaleString()}</span></td>
                  <td style={{ padding: '12px' }}><YieldBadge value={pool.yield} /></td>
                  <td style={{ padding: '12px', textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                     <button onClick={() => onAddLiquidity(pool)} style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${theme.accent}40`, background: `${theme.accent}10`, color: theme.accent, fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Add</button>
                     {pool.txHash && <a href={`${currentChainId === 1301 ? 'https://sepolia.uniscan.xyz' : 'https://sepolia.basescan.org'}/tx/${pool.txHash}`} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 10px', borderRadius: '8px', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textSecondary, fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>↗</a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


// ============ AGENT BUILDER INTERFACE ============

// Sub-panel: Wallet Management (v2 — CDP-backed)
const AgentWalletPanel = ({ theme, isDark, address, balance }) => {
  const [agentWallet, setAgentWallet] = useState<{address:string;walletId:string;baseScanUrl?:string} | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreateWallet = async () => {
    if (!address) { setError('Connect your wallet first.'); return; }
    setIsCreating(true);
    setError('');
    try {
      const res = await fetch('/api/agent/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: address }),
      });
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      if (data.address) setAgentWallet({ address: data.address, walletId: data.walletId, baseScanUrl: data.baseScanUrl });
    } catch {
      setError('Failed to create wallet. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const fieldStyle = { padding: '16px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderRadius: '10px', border: `1px solid ${theme.border}`, marginBottom: '12px' };

  return (
    <div style={{ padding: '24px', background: theme.bgCard, borderRadius: '14px', border: `1px solid ${theme.border}` }}>
      <h3 style={{ color: theme.textPrimary, fontSize: '16px', fontWeight: '600', margin: '0 0 20px 0' }}>🔐 Create & Manage Wallet</h3>
      <div style={fieldStyle}>
        <div style={{ fontSize: '11px', color: theme.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Your Connected Wallet</div>
        <div style={{ fontFamily: 'monospace', fontSize: '13px', color: theme.textPrimary }}>
          {address ? `${address.slice(0, 10)}...${address.slice(-8)}` : 'Not connected'}
        </div>
      </div>

      <div style={fieldStyle}>
        <div style={{ fontSize: '11px', color: theme.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Agent Wallet (CDP MPC)</div>
        {agentWallet ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '600' }}>✅ Wallet created successfully</span>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '13px', color: theme.textPrimary, marginBottom: '10px', wordBreak: 'break-all' }}>
              {agentWallet.address}
            </div>
            {agentWallet.baseScanUrl && (
              <a href={agentWallet.baseScanUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
                View on BaseScan →
              </a>
            )}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '13px', color: theme.textMuted, marginBottom: '14px', lineHeight: '1.5' }}>
              Create a CDP-managed wallet for autonomous on-chain operations on Base Sepolia.
            </div>
            <button onClick={handleCreateWallet} disabled={isCreating}
              style={{ padding: '12px 22px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: '600', cursor: isCreating ? 'wait' : 'pointer', opacity: isCreating ? 0.7 : 1 }}>
              {isCreating ? 'Creating...' : 'Create Agent Wallet'}
            </button>
            {!address && <div style={{ marginTop: '8px', fontSize: '12px', color: theme.textMuted }}>Connect your wallet to continue.</div>}
          </div>
        )}
      </div>
      {error && <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '13px' }}>{error}</div>}
    </div>
  );
};

// Sub-panel: Token Transfer
const AgentTransferPanel = ({ theme, isDark }) => {
  const { address } = useAccount();
  const [toAddress, setToAddress] = useState('');
  const [selectedToken, setSelectedToken] = useState('ETH');
  const [amount, setAmount] = useState('');
  const [txStatus, setTxStatus] = useState(null);
  const [txHash, setTxHash] = useState('');

  const quickTokens = ['ETH', 'cbBTC', 'USDC', 'EURC'];

  const handleTransfer = async () => {
    if (!toAddress || !amount || !address) return;
    setTxStatus('pending');
    try {
      const res = await fetch('/api/agent/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: address, to: toAddress, token: selectedToken, amount }),
      });
      const data = await res.json();
      if (data.txHash) {
        setTxHash(data.txHash);
        setTxStatus('success');
      } else {
        setTxStatus('error');
      }
    } catch {
      setTxStatus('error');
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
    border: `1px solid ${theme.border}`,
    borderRadius: '8px',
    color: theme.textPrimary,
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const labelStyle = { display: 'block', fontSize: '11px', color: theme.textMuted, fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '8px' };

  return (
    <div style={{ padding: '24px', background: theme.bgCard, borderRadius: '14px', border: `1px solid ${theme.border}` }}>
      <h3 style={{ color: theme.textPrimary, fontSize: '16px', fontWeight: '600', margin: '0 0 20px 0' }}>Send Tokens</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={labelStyle}>Recipient Address</label>
          <input type="text" value={toAddress} onChange={e => setToAddress(e.target.value)} placeholder="0x..." style={{ ...inputStyle, fontFamily: 'monospace' }} />
        </div>
        <div>
          <label style={labelStyle}>Token</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {quickTokens.map(t => (
              <button key={t} onClick={() => setSelectedToken(t)} style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${selectedToken === t ? '#10b981' : theme.border}`, background: selectedToken === t ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: selectedToken === t ? '#10b981' : theme.textSecondary, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Amount</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.0" min="0" style={inputStyle} />
        </div>
        <button
          onClick={handleTransfer}
          disabled={!toAddress || !amount || txStatus === 'pending'}
          style={{ padding: '14px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '15px', fontWeight: '600', cursor: (!toAddress || !amount || txStatus === 'pending') ? 'not-allowed' : 'pointer', opacity: (!toAddress || !amount || txStatus === 'pending') ? 0.7 : 1 }}
        >
          {txStatus === 'pending' ? 'Sending...' : `Send ${selectedToken}`}
        </button>
        {txStatus === 'success' && (
          <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', fontSize: '13px' }}>
            ✓ Transaction submitted!{txHash && <> &nbsp;<a href={`https://sepolia.basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981' }}>View on explorer ↗</a></>}
          </div>
        )}
        {txStatus === 'error' && (
          <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '13px' }}>
            Transfer failed. Check the details and try again.
          </div>
        )}
      </div>
    </div>
  );
};

// Sub-panel: Onchain Analytics Query — powered by Dune Analytics + CoinGecko
// ─── Agent v2: Query Panel ────────────────────────────────────────────────────
const AgentQueryPanel = ({ theme, isDark }) => {
  const { address } = useAccount();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [duneResult, setDuneResult] = useState<any>(null);
  const [localResult, setLocalResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'dune' | 'local'>('dune');

  const duneExamples = [
    'NFT marketplace rankings',
    'DEX volume overview',
    'Uniswap v4 activity on Base',
    'ETH gas analytics',
  ];

  const localExamples = [
    "What's the price of ETH?",
    "Show all token prices",
    "List all pools",
    "Show my transaction history",
  ];

  const handleQuery = async (q?: string) => {
    const text = q ?? query;
    if (!text.trim()) return;
    if (q) setQuery(q);
    setIsLoading(true);
    setDuneResult(null);
    setLocalResult(null);

    if (activeTab === 'dune') {
      try {
        const res = await fetch('/api/dune/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });
        const data = await res.json();
        setDuneResult(data);
      } catch {
        setDuneResult({ success: false, message: 'Failed to reach Dune API. Please try again.' });
      }
    } else {
      try {
        const res = await fetch('/api/agent/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: text, walletAddress: address }),
        });
        const data = await res.json();
        setLocalResult(data);
      } catch {
        setLocalResult({ error: 'Failed to fetch data. Please try again.' });
      }
    }
    setIsLoading(false);
  };

  return (
    <div style={{ padding: '24px', background: theme.bgCard, borderRadius: '14px', border: `1px solid ${theme.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ color: theme.textPrimary, fontSize: '16px', fontWeight: '600', margin: 0 }}>🔍 Query On-Chain Data</h3>
        <div style={{ display: 'flex', borderRadius: '8px', border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
          {(['dune', 'local'] as const).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setDuneResult(null); setLocalResult(null); }}
              style={{ padding: '5px 14px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                background: activeTab === tab ? (tab === 'dune' ? '#f59e0b' : '#3b82f6') : 'transparent',
                color: activeTab === tab ? 'white' : theme.textSecondary, transition: 'all 0.15s' }}>
              {tab === 'dune' ? '🟡 Dune' : '⚡ Local'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        <input type="text" value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleQuery()}
          placeholder={activeTab === 'dune' ? 'NFT marketplace rankings / DEX volume / Uniswap v4 on Base...' : "What's the price of ETH? / List pools..."}
          style={{ flex: 1, padding: '12px 16px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
            border: `1px solid ${activeTab === 'dune' ? 'rgba(245,158,11,0.35)' : theme.border}`,
            borderRadius: '8px', color: theme.textPrimary, fontSize: '14px', outline: 'none' }} />
        <button onClick={() => handleQuery()} disabled={!query.trim() || isLoading}
          style={{ padding: '12px 20px', background: activeTab === 'dune' ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#06b6d4,#0891b2)',
            border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: '600',
            cursor: (!query.trim() || isLoading) ? 'not-allowed' : 'pointer', opacity: (!query.trim() || isLoading) ? 0.7 : 1 }}>
          {isLoading ? '...' : 'Ask'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {(activeTab === 'dune' ? duneExamples : localExamples).map(q => (
          <button key={q} onClick={() => handleQuery(q)}
            style={{ padding: '4px 12px', borderRadius: '14px',
              border: `1px solid ${activeTab === 'dune' ? 'rgba(245,158,11,0.3)' : theme.border}`,
              background: 'transparent', color: activeTab === 'dune' ? '#f59e0b' : theme.textSecondary,
              fontSize: '12px', cursor: 'pointer' }}>
            {q}
          </button>
        ))}
      </div>

      {isLoading && (
        <div style={{ padding: '16px', textAlign: 'center', color: theme.textMuted }}>
          {activeTab === 'dune' ? '🟡 Querying Dune Analytics...' : '⚡ Fetching data...'}
        </div>
      )}

      {/* Dune results — formatted table */}
      {duneResult && !isLoading && (
        duneResult.success && duneResult.data ? (
          <DuneResultTable data={duneResult.data} isDark={isDark} />
        ) : (
          <div>
            <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: '13px', marginBottom: '8px' }}>
              {duneResult.message ?? duneResult.error ?? 'No results found.'}
            </div>
            {duneResult.suggestions?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {duneResult.suggestions.map((s: any) => (
                  <button key={s.id} onClick={() => { setQuery(s.name); handleQuery(s.name); }}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid rgba(245,158,11,0.25)`, background: 'rgba(245,158,11,0.06)', color: '#f59e0b', fontSize: '12px', textAlign: 'left', cursor: 'pointer' }}>
                    <strong>{s.name}</strong> — {s.description}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* Local results */}
      {localResult && !isLoading && (
        <div style={{ padding: '16px', borderRadius: '10px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', border: `1px solid ${theme.border}`, maxHeight: '300px', overflowY: 'auto' }}>
          {localResult.error ? (
            <div style={{ color: '#ef4444', fontSize: '13px' }}>{localResult.error}</div>
          ) : (
            <pre style={{ color: theme.textPrimary, fontSize: '13px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', margin: 0 }}>
              {JSON.stringify(localResult.data ?? localResult, null, 2)}
            </pre>
          )}
        </div>
      )}

      {!duneResult && !localResult && !isLoading && (
        <div style={{ fontSize: '11px', color: theme.textMuted }}>
          🟡 <strong>Dune tab</strong> — live on-chain analytics powered by{' '}
          <a href="https://dune.com" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>Dune Analytics</a>
          &nbsp;·&nbsp; ⚡ <strong>Local tab</strong> — token prices, pools, transaction history
        </div>
      )}
    </div>
  );
};

// ─── Agent v2: Faucet Panel ───────────────────────────────────────────────────
const AgentFaucetPanel = ({ theme, isDark }) => {
  const { address } = useAccount();
  const [agentAddress, setAgentAddress] = useState<string | null>(null);
  const [loadingAgent, setLoadingAgent] = useState(true);
  const [selectedTokens, setSelectedTokens] = useState<string[]>(['eth']);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Array<{token:string;success:boolean;txHash?:string;baseScanUrl?:string;error?:string}>>([]);

  // Fetch agent wallet address from DB — faucet must target agent wallet, not user wallet
  useEffect(() => {
    if (!address) return;
    setLoadingAgent(true);
    fetch(`/api/portfolio/agent-wallets?userId=${address}`)
      .then(r => r.ok ? r.json() : null)
      .then(wallet => setAgentAddress(wallet?.address ?? null))
      .catch(() => setAgentAddress(null))
      .finally(() => setLoadingAgent(false));
  }, [address]);

  const tokens = [
    { id: 'eth', label: 'ETH', color: '#627EEA' },
    { id: 'cbbtc', label: 'cbBTC', color: '#F7931A' },
    { id: 'usdc', label: 'USDC', color: '#2775CA' },
    { id: 'eurc', label: 'EURC', color: '#0052B4' },
  ];

  const toggle = (id: string) => {
    setSelectedTokens(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const handleRequest = async () => {
    if (!agentAddress || !selectedTokens.length) return;
    setIsLoading(true);
    setResults([]);
    try {
      const res = await fetch('/api/agent/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: agentAddress, tokens: selectedTokens }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([{ token: 'all', success: false, error: 'Request failed. Visit https://portal.cdp.coinbase.com/products/faucet' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', background: theme.bgCard, borderRadius: '14px', border: `1px solid ${theme.border}` }}>
      <h3 style={{ color: theme.textPrimary, fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>🚰 Get Testnet Funds</h3>

      {/* Agent wallet address (read-only — faucet always targets agent wallet) */}
      <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '10px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', border: `1px solid ${theme.border}` }}>
        <div style={{ fontSize: '11px', color: theme.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Sending to Agent Wallet</div>
        {loadingAgent ? (
          <div style={{ color: theme.textMuted, fontSize: '13px' }}>Loading agent wallet...</div>
        ) : agentAddress ? (
          <div style={{ fontFamily: 'monospace', fontSize: '13px', color: theme.textPrimary, wordBreak: 'break-all' }}>{agentAddress}</div>
        ) : (
          <div style={{ color: '#ef4444', fontSize: '13px' }}>
            No agent wallet found. Create one first using the "Create &amp; Manage Wallet" card.
          </div>
        )}
      </div>

      {agentAddress && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Tokens</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {tokens.map(t => (
                <button key={t.id} onClick={() => toggle(t.id)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: `1.5px solid ${selectedTokens.includes(t.id) ? t.color : theme.border}`, background: selectedTokens.includes(t.id) ? `${t.color}15` : 'transparent', color: selectedTokens.includes(t.id) ? t.color : theme.textSecondary, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleRequest} disabled={isLoading || !selectedTokens.length}
            style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '15px', fontWeight: '600', cursor: (isLoading || !selectedTokens.length) ? 'not-allowed' : 'pointer', opacity: (isLoading || !selectedTokens.length) ? 0.6 : 1 }}>
            {isLoading ? 'Requesting...' : 'Request Testnet Funds'}
          </button>
          {results.length > 0 && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {results.map((r, i) => (
                <div key={i} style={{ padding: '12px 16px', borderRadius: '8px', background: r.success ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${r.success ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                  <div style={{ color: r.success ? '#10b981' : '#ef4444', fontWeight: '600', fontSize: '13px', marginBottom: r.baseScanUrl ? '4px' : 0 }}>
                    {r.success ? `✅ ${r.token.toUpperCase()} sent to agent wallet` : `❌ ${r.token.toUpperCase()}: ${r.error}`}
                  </div>
                  {r.baseScanUrl && (
                    <a href={r.baseScanUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#10b981', fontSize: '12px', textDecoration: 'underline' }}>
                      View on BaseScan →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', fontSize: '12px', color: theme.textSecondary }}>
        💡 Alternatively, visit <a href="https://portal.cdp.coinbase.com/products/faucet" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Coinbase CDP Faucet</a> to claim tokens directly.
      </div>
    </div>
  );
};

// ─── Agent v2: Autonomous Mode ────────────────────────────────────────────────
const AgentAutonomousPanel = ({ theme, isDark, onNavigate }) => {
  const { address } = useAccount();
  const [instruction, setInstruction] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [messages, setMessages] = useState<Array<{role:'agent'|'user';text:string;txHash?:string}>>([]);

  const [duneTableData, setDuneTableData] = useState<any>(null);

  const suggestions = [
    'Swap 0.001 ETH for USDC',
    'What is the current ETH price?',
    'Get me testnet ETH',
    'NFT marketplace rankings',
    'Show DEX volume overview',
  ];

  const isOnChainQuery = (text: string) => {
    const lower = text.toLowerCase();
    return lower.includes('dune') || lower.includes('on-chain') || lower.includes('tvl') ||
      lower.includes('nft') || lower.includes('volume') || lower.includes('analytics') ||
      lower.includes('uniswap v4') || lower.includes('defi') || lower.includes('gas fee') ||
      lower.includes('gas trend') || lower.includes('marketplace') || lower.includes('protocol') ||
      lower.includes('dex') || lower.includes('opensea') || lower.includes('blur');
  };

  const execute = async (cmd?: string) => {
    const text = cmd ?? instruction;
    if (!text.trim()) return;
    const userMsg = { role: 'user' as const, text };
    setMessages(prev => [...prev, userMsg]);
    setInstruction('');
    setIsExecuting(true);
    setDuneTableData(null);

    const lower = text.toLowerCase();
    try {
      if (isOnChainQuery(text)) {
        // Route on-chain analytics queries to /api/dune/query
        setMessages(prev => [...prev, { role: 'agent', text: '🟡 Querying Dune Analytics for on-chain data...' }]);
        const res = await fetch('/api/dune/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
        const json = await res.json();
        if (json.success && json.data?.rows?.length > 0) {
          setDuneTableData(json.data);
          setMessages(prev => [...prev, { role: 'agent', text: `📊 Retrieved ${json.data.rowCount} rows for: ${json.data.label}` }]);
        } else {
          const msg = json.message || 'No matching Dune query found. Try: "NFT marketplace rankings", "DEX volume", or "ETH gas analytics".';
          setMessages(prev => [...prev, { role: 'agent', text: `🟡 ${msg}` }]);
        }
      } else if (lower.includes('price') || lower.includes('worth')) {
        const res = await fetch('/api/agent/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: text, walletAddress: address }) });
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'agent', text: `📊 ${JSON.stringify(data.data ?? data, null, 2)}` }]);
      } else if (lower.includes('create wallet') || lower.includes('make wallet')) {
        if (!address) { setMessages(prev => [...prev, { role: 'agent', text: '⚠️ Connect your wallet first to create an agent wallet.' }]); return; }
        const res = await fetch('/api/agent/wallet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: address }) });
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'agent', text: `✅ Agent wallet created!\nAddress: ${data.address}\n\n${data.baseScanUrl ? `View on BaseScan: ${data.baseScanUrl}` : ''}` }]);
      } else if (lower.includes('faucet') || lower.includes('testnet eth') || lower.includes('get me eth')) {
        setMessages(prev => [...prev, { role: 'agent', text: '🚰 Opening faucet panel... Use the "Get Testnet Funds" action card below.' }]);
      } else if (lower.includes('swap')) {
        setMessages(prev => [...prev, { role: 'agent', text: '🔄 Opening swap interface...' }]);
        setTimeout(() => onNavigate('swap'), 1000);
      } else if (lower.includes('liquidity') || lower.includes('pool')) {
        setMessages(prev => [...prev, { role: 'agent', text: '💧 Opening liquidity interface...' }]);
        setTimeout(() => onNavigate('liquidity'), 1000);
      } else {
        // Generic query — try local first
        const res = await fetch('/api/agent/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: text, walletAddress: address }) });
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'agent', text: `📋 ${JSON.stringify(data.data ?? data, null, 2)}` }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'agent', text: '❌ Action failed. Please try again or use the action cards below.' }]);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div style={{ padding: '24px', background: theme.bgCard, borderRadius: '14px', border: `1px solid ${theme.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🤖</div>
        <div>
          <div style={{ color: theme.textPrimary, fontWeight: '700', fontSize: '16px' }}>Autonomous Mode</div>
          <div style={{ color: theme.textMuted, fontSize: '12px' }}>Tell the agent what to do · Dune on-chain data enabled</div>
        </div>
      </div>

      {/* Message history */}
      {messages.length > 0 && (
        <div style={{ marginBottom: '16px', maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.role === 'user' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'), color: m.role === 'user' ? 'white' : theme.textPrimary, fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                {m.text}
              </div>
            </div>
          ))}
          {isExecuting && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '10px 14px', borderRadius: '14px 14px 14px 4px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', width: 'fit-content' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6', animation: 'pulse 1s infinite' }} />
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6', animation: 'pulse 1s 0.2s infinite' }} />
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6', animation: 'pulse 1s 0.4s infinite' }} />
            </div>
          )}
        </div>
      )}

      {/* Dune Analytics result table */}
      {duneTableData && !isExecuting && (
        <div style={{ marginBottom: '16px' }}>
          <DuneResultTable data={duneTableData} isDark={isDark} />
        </div>
      )}

      {/* Suggestions */}
      {messages.length === 0 && (
        <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {suggestions.map(s => (
            <button key={s} onClick={() => execute(s)}
              style={{ padding: '6px 14px', borderRadius: '14px', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textSecondary, fontSize: '12px', cursor: 'pointer' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        <input value={instruction} onChange={e => setInstruction(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && execute()}
          placeholder="Type your instruction..."
          style={{ flex: 1, padding: '12px 16px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', border: `1px solid ${theme.border}`, borderRadius: '10px', color: theme.textPrimary, fontSize: '14px', outline: 'none' }} />
        <button onClick={() => execute()} disabled={!instruction.trim() || isExecuting}
          style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px', fontWeight: '600', cursor: (!instruction.trim() || isExecuting) ? 'not-allowed' : 'pointer', opacity: (!instruction.trim() || isExecuting) ? 0.6 : 1 }}>
          Execute
        </button>
      </div>
    </div>
  );
};

// ─── Main AgentBuilderInterface (v2) ─────────────────────────────────────────
const AgentBuilderInterface = ({ onClose, theme, isDark, onNavigate }) => {
  const [mode, setMode] = useState<'select' | 'chat' | 'autonomous'>('select');
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const { address } = useAccount();
  const { data: balance } = useBalance({ address });

  const actions = [
    { id: 'wallet',    color: '#3b82f6', emoji: '🔐', title: 'Create & Manage Wallet',  subtitle: 'Create agent wallet via CDP', },
    { id: 'transfer',  color: '#10b981', emoji: '📤', title: 'Send Tokens',              subtitle: 'Transfer tokens to any address', },
    { id: 'swap',      color: '#f59e0b', emoji: '🔄', title: 'Swap Tokens',              subtitle: 'Exchange between ETH/cbBTC/USDC/EURC', },
    { id: 'liquidity', color: '#8b5cf6', emoji: '💧', title: 'Liquidity',                subtitle: 'Add/remove liquidity from a pool', },
    { id: 'query',     color: '#06b6d4', emoji: '🔍', title: 'Query On-Chain Data',      subtitle: 'Fetch any crypto data', },
    { id: 'faucet',    color: '#f97316', emoji: '🚰', title: 'Get Testnet Funds',        subtitle: 'Request tokens from CDP Faucet', },
  ];

  if (mode === 'select') {
    return (
      <div style={{ width: '100%', fontFamily: '"DM Sans", sans-serif' }}>
        <div style={{ background: theme.bgCard, borderRadius: '20px', border: `1px solid ${theme.border}`, padding: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>🤖</div>
          <h2 style={{ color: theme.textPrimary, fontSize: '22px', fontWeight: '700', margin: '0 0 8px 0' }}>Choose Agent Mode</h2>
          <p style={{ color: theme.textSecondary, fontSize: '14px', margin: '0 0 32px 0' }}>How would you like to interact with the agent?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '500px', margin: '0 auto' }}>
            <button onClick={() => setMode('chat')}
              style={{ padding: '28px 20px', borderRadius: '16px', border: `2px solid ${theme.border}`, background: theme.bgSecondary, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.background = 'rgba(139,92,246,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.background = theme.bgSecondary; }}>
              <div style={{ fontSize: '28px', marginBottom: '10px' }}>💬</div>
              <div style={{ color: theme.textPrimary, fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>Chat Mode</div>
              <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: '1.5' }}>Interactive action cards with guided steps</div>
            </button>
            <button onClick={() => setMode('autonomous')}
              style={{ padding: '28px 20px', borderRadius: '16px', border: `2px solid ${theme.border}`, background: theme.bgSecondary, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.background = theme.bgSecondary; }}>
              <div style={{ fontSize: '28px', marginBottom: '10px' }}>🤖</div>
              <div style={{ color: theme.textPrimary, fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>Autonomous Mode</div>
              <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: '1.5' }}>Give the agent an instruction & it executes autonomously</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'autonomous') {
    return (
      <div style={{ width: '100%', fontFamily: '"DM Sans", sans-serif' }}>
        <button onClick={() => setMode('select')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: theme.textSecondary, fontSize: '13px', cursor: 'pointer', marginBottom: '16px', padding: '4px 0' }}>
          ← Back to mode selection
        </button>
        <AgentAutonomousPanel theme={theme} isDark={isDark} onNavigate={onNavigate} />
      </div>
    );
  }

  // Chat mode: 6 action cards
  const renderPanel = () => {
    switch (activeAction) {
      case 'wallet': return <AgentWalletPanel theme={theme} isDark={isDark} address={address} balance={balance} />;
      case 'transfer': return <AgentTransferPanel theme={theme} isDark={isDark} />;
      case 'swap': return (
        <div style={{ padding: '24px', background: theme.bgCard, borderRadius: '14px', border: `1px solid ${theme.border}` }}>
          <h3 style={{ color: theme.textPrimary, margin: '0 0 12px 0' }}>🔄 Swap Tokens</h3>
          <p style={{ color: theme.textSecondary, fontSize: '14px', marginBottom: '20px' }}>Execute token swaps via Uniswap v4 on Base Sepolia. Supports ETH, cbBTC, USDC, EURC.</p>
          <button onClick={() => onNavigate('swap')} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer' }}>
            Open Swap Interface →
          </button>
        </div>
      );
      case 'liquidity': return (
        <div style={{ padding: '24px', background: theme.bgCard, borderRadius: '14px', border: `1px solid ${theme.border}` }}>
          <h3 style={{ color: theme.textPrimary, margin: '0 0 12px 0' }}>💧 Liquidity Management</h3>
          <p style={{ color: theme.textSecondary, fontSize: '14px', marginBottom: '20px' }}>Add or remove liquidity from Uniswap v4 pools. Supports ETH, cbBTC, USDC, EURC pairs.</p>
          <button onClick={() => onNavigate('liquidity')} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer' }}>
            Open Liquidity Interface →
          </button>
        </div>
      );
      case 'query': return <AgentQueryPanel theme={theme} isDark={isDark} />;
      case 'faucet': return <AgentFaucetPanel theme={theme} isDark={isDark} />;
      default: return null;
    }
  };

  return (
    <div style={{ width: '100%', fontFamily: '"DM Sans", sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button onClick={() => { setMode('select'); setActiveAction(null); }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: theme.textSecondary, fontSize: '13px', cursor: 'pointer', padding: '4px 0' }}>
          ← Back
        </button>
        <div style={{ color: theme.textPrimary, fontWeight: '600', fontSize: '14px' }}>💬 Chat Mode</div>
        <div />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: activeAction ? '20px' : '0' }}>
        {actions.map(action => {
          const isActive = activeAction === action.id;
          return (
            <button key={action.id} onClick={() => setActiveAction(isActive ? null : action.id)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '18px', background: isActive ? `${action.color}12` : theme.bgCard, border: `1.5px solid ${isActive ? action.color : theme.border}`, borderRadius: '14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = `${action.color}66`; e.currentTarget.style.background = `${action.color}08`; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.background = theme.bgCard; } }}>
              <div style={{ fontSize: '22px', marginBottom: '10px' }}>{action.emoji}</div>
              <div style={{ color: theme.textPrimary, fontWeight: '600', fontSize: '12px', marginBottom: '3px' }}>{action.title}</div>
              <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: '1.4' }}>{action.subtitle}</div>
            </button>
          );
        })}
      </div>

      {activeAction && <div style={{ marginTop: '4px' }}>{renderPanel()}</div>}
    </div>
  );
};

// ============ CHAIN SELECTOR ============
const ChainSelector = ({ selectedChain, chains, onSelect, theme, isDark }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentChain = chains[selectedChain];

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
          border: `1px solid ${theme.border}`,
          borderRadius: '12px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          color: theme.textPrimary,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
          e.currentTarget.style.borderColor = currentChain.color;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)';
          e.currentTarget.style.borderColor = theme.border;
        }}
      >
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: currentChain.color,
          boxShadow: `0 0 8px ${currentChain.color}60`,
        }} />
        <span style={{
          fontSize: '13px',
          fontWeight: '600',
          color: theme.textPrimary,
        }}>
          {currentChain.shortName}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            color: theme.textSecondary,
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '0',
          marginBottom: '8px',
          background: theme.bgCard,
          border: `1px solid ${theme.border}`,
          borderRadius: '12px',
          boxShadow: isDark
            ? '0 8px 32px rgba(0, 0, 0, 0.4)'
            : '0 8px 32px rgba(0, 0, 0, 0.12)',
          overflow: 'hidden',
          minWidth: '200px',
          zIndex: 1000,
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${theme.border}`,
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              color: theme.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Select Network
            </span>
          </div>

          {Object.entries(chains).map(([chainId, chain]) => (
            <button
              key={chainId}
              onClick={() => {
                onSelect(chainId);
                setIsOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '12px 16px',
                background: selectedChain === chainId
                  ? (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)')
                  : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (selectedChain !== chainId) {
                  e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedChain !== chainId) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: `${chain.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
              }}>
                {chain.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  color: theme.textPrimary,
                  fontWeight: '600',
                  fontSize: '14px',
                  marginBottom: '2px',
                }}>
                  {chain.name}
                </div>
                <div style={{
                  color: theme.textMuted,
                  fontSize: '12px',
                }}>
                  Testnet
                </div>
              </div>
              {selectedChain === chainId && (
                <div style={{ color: chain.color }}>
                  <CheckIcon />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ============ MAIN APP ============
export default function MantuaApp() {
  const [location, setLocation] = useLocation();
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mantua-theme');
      if (saved) return saved === 'dark';
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem('mantua-theme', isDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Chain configuration — Base Sepolia + Unichain Sepolia
  const SUPPORTED_CHAINS = {
    'base-sepolia': {
      id: 84532,
      name: 'Base Sepolia',
      shortName: 'Base',
      icon: '🔵',
      color: '#3b82f6',
      rpcUrl: 'https://sepolia.base.org',
      blockExplorer: 'https://sepolia.basescan.org',
    },
    'unichain-sepolia': {
      id: 1301,
      name: 'Unichain Sepolia',
      shortName: 'Unichain',
      icon: '🦄',
      color: '#f472b6',
      rpcUrl: 'https://sepolia.unichain.org',
      blockExplorer: 'https://sepolia.uniscan.xyz',
    },
  };

  // selectedChain is driven by the wallet's actual chainId so they stay in sync
  const [selectedChain, setSelectedChain] = useState<string>('base-sepolia');
  const currentChain = SUPPORTED_CHAINS[selectedChain] ?? SUPPORTED_CHAINS['base-sepolia'];

  // Sync wallet chainId → UI selectedChain (wallet is source of truth)
  const currentChainId = useChainId();
  useEffect(() => {
    const matched = Object.entries(SUPPORTED_CHAINS).find(([, c]) => c.id === currentChainId);
    if (matched) setSelectedChain(matched[0]);
  }, [currentChainId]);

  // Real wallet connection using AppKit
  const { isConnected, address, truncatedAddress } = useWalletConnection();

  // Token balances (used for balance chat command) — auto-scoped to current chain
  const { balances: tokenBalances, balancesBySymbol } = useTokenBalances();
  const { data: ethBalanceData } = useBalance({ address, chainId: currentChainId });

  // Chain switching hook
  const { switchChain } = useSwitchChain();

  // Handler: UI chain selector → switch wallet network
  // The useEffect above will sync the wallet's new chainId back to selectedChain.
  const handleChainSwitch = async (chainKey: string) => {
    const chain = SUPPORTED_CHAINS[chainKey];
    if (!chain) return;

    if (isConnected && switchChain) {
      try {
        await switchChain({ chainId: chain.id });
        // selectedChain will update via the useEffect that watches currentChainId
      } catch (error) {
        console.error('Failed to switch chain:', error);
        // Revert UI to match actual wallet chain
        const walletChainKey = Object.entries(SUPPORTED_CHAINS).find(
          ([, c]) => c.id === currentChainId
        )?.[0];
        if (walletChainKey) setSelectedChain(walletChainKey);
      }
    } else {
      // Wallet not connected — just update UI optimistically
      setSelectedChain(chainKey);
    }
  };

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [recentChatsOpen, setRecentChatsOpen] = useState(true);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [showLiquidity, setShowLiquidity] = useState(false);
  const [showAgentBuilder, setShowAgentBuilder] = useState(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [showAddLiquidityModal, setShowAddLiquidityModal] = useState(false);
  const [selectedPool, setSelectedPool] = useState(null);
  const [addLiquidityMode, setAddLiquidityMode] = useState<'add' | 'create' | 'remove'>('add');
  const [liquidityInitialTokens, setLiquidityInitialTokens] = useState<{tokenA?: string; tokenB?: string} | null>(null);
  const [portfolioType, setPortfolioType] = useState('User');
  const [swapDetails, setSwapDetails] = useState(null);
  // Voice command state
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceParsedCommand, setVoiceParsedCommand] = useState(null);
  const isVoiceSubmitRef = useRef(false);
  // Persistent chat state from useChat hook — pass chainId for context-aware AI responses
  const { messages: chatMessages, sendMessage, updateSessionTitle, isSending, isLoading: chatIsLoading, userId: chatUserId } = useChat({ chainId: currentChainId });
  const [analyticsMessages, setAnalyticsMessages] = useState<any[]>([]);
  const allMessages = useMemo(() => {
    const combined = [...chatMessages, ...analyticsMessages];
    combined.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return combined;
  }, [chatMessages, analyticsMessages]);

  const walletAddress = truncatedAddress || '0xbaac...DC87';

  // Track wallet connection event
  useEffect(() => {
    if (isConnected && address) {
      trackEvent('wallet_connected', address);
    }
  }, [isConnected, address]);

  const [recentChats, setRecentChats] = useState([]);

  const loadRecentChats = React.useCallback(async () => {
    if (!chatUserId) return;
    try {
      const res = await fetch(`/api/chat/sessions/${chatUserId}`);
      if (!res.ok) return;
      const data = await res.json();
      setRecentChats(data.sessions ?? []);
    } catch (error) {
      console.error('Failed to load recent chats:', error);
    }
  }, [chatUserId]);

  useEffect(() => {
    loadRecentChats();
  }, [loadRecentChats]);

  const [hasInteracted, setHasInteracted] = useState(false);

  const theme = isDark ? themes.dark : themes.light;

  // Parse swap command from user input
  const parseSwapCommand = (input) => {
    const swapRegex = /swap\s+(\d*\.?\d+)?\s*(\w+)?\s*(?:for|to|->|→)?\s*(\w+)?(?:\s+(?:using|with)\s+(.+))?/i;
    const match = input.match(swapRegex);
    
    if (match || input.toLowerCase().includes('swap')) {
      return {
        fromAmount: match?.[1] || '',
        fromToken: match?.[2]?.toUpperCase() || '',
        toToken: match?.[3]?.toUpperCase() || '',
        hook: match?.[4]?.trim() || ''
      };
    }
    return null;
  };

  // ── Voice transcription handler ───────────────────────────────────────
  const handleTranscription = (transcript) => {
    const text = transcript.trim();
    if (!text) return;
    // Track voice command usage
    trackEvent('voice_command', address, { commandLength: text.length });
    isVoiceSubmitRef.current = true;
    const parsed = parseVoiceCommand(text);
    if (parsed) {
      setVoiceTranscript(text);
      setVoiceParsedCommand(parsed);
      setVoiceModalOpen(true);
    } else {
      handleChatSubmit(text);
    }
  };

  const handleVoiceConfirm = () => {
    setVoiceModalOpen(false);
    if (voiceTranscript) { isVoiceSubmitRef.current = true; handleChatSubmit(voiceTranscript); }
    setVoiceTranscript('');
    setVoiceParsedCommand(null);
  };

  const handleVoiceCancel = () => {
    setVoiceModalOpen(false);
    setVoiceTranscript('');
    setVoiceParsedCommand(null);
  };

  // Main chat submission — called by ChatInput and voice pipeline
  const handleChatSubmit = async (text) => {
    const inputValue = sanitizeInput(text, 'chatMessage');
    if (!inputValue.trim()) return;

    // Track text vs voice command (voice sets isVoiceSubmitRef before calling this)
    if (!isVoiceSubmitRef.current) {
      trackEvent('text_command', address);
    }
    isVoiceSubmitRef.current = false;

    setHasInteracted(true);

    // ── Dune Analytics detection ─────────────────────────────────────────────
    const duneKeywords = ['volume', 'tvl', 'liquidity pool', 'on-chain', 'onchain', 'dune',
      'analytics', 'nft marketplace', 'opensea', 'blur', 'dex volume', 'uniswap v4',
      'holders', 'gas fee', 'gas trend', 'defi protocol'];
    const isDuneMessage = duneKeywords.some(kw => inputValue.toLowerCase().includes(kw));

    if (isDuneMessage) {
      const placeholderId = 'dune-' + Date.now();
      const userMsgId = 'user-dune-' + Date.now();
      // Add user message + loading placeholder
      setAnalyticsMessages(prev => [...prev,
        { id: userMsgId, sessionId: '', role: 'user' as const, content: inputValue, createdAt: new Date().toISOString() },
        { id: placeholderId, sessionId: '', role: 'assistant' as const, content: '', dune: { rows: [], columns: [], rowCount: 0, label: 'Querying Dune...', isLoading: true }, createdAt: new Date().toISOString() },
      ]);
      try {
        const res = await fetch('/api/dune/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: inputValue }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          setAnalyticsMessages(prev => prev.map(m => m.id === placeholderId ? {
            ...m,
            content: '',
            dune: { ...json.data, isLoading: false },
          } : m));
        } else {
          const msg = json.message || 'No matching Dune query found.';
          setAnalyticsMessages(prev => prev.map(m => m.id === placeholderId ? {
            ...m,
            content: msg,
            dune: null,
          } : m));
        }
      } catch {
        setAnalyticsMessages(prev => prev.map(m => m.id === placeholderId ? {
          ...m,
          content: 'Failed to query on-chain data. Please try again.',
          dune: null,
        } : m));
      }
      return;
    }

    if (isAnalyticsQuery(inputValue)) {
      const placeholderId = 'chart-' + Date.now();
      const chartMsg = {
        id: placeholderId,
        sessionId: '',
        role: 'assistant' as const,
        content: '',
        chart: {
          chartType: 'stat' as const,
          title: 'Querying on-chain data...',
          description: inputValue,
          data: [],
          isLoading: true,
          error: null,
        },
        createdAt: new Date().toISOString(),
      };
      setAnalyticsMessages(prev => [...prev, {
        id: 'user-' + Date.now(),
        sessionId: '',
        role: 'user' as const,
        content: inputValue,
        createdAt: new Date().toISOString(),
      }, chartMsg]);

      try {
        const analyticsResult = await generateAnalyticsQuery(inputValue);
        if (analyticsResult) {
          const subgraphResult = await gqlQuery(analyticsResult.graphql, analyticsResult.variables ?? {});
          const normalized = normalizeForChart(subgraphResult.merged ?? {}, analyticsResult.chartType);
          setAnalyticsMessages(prev => prev.map(m => m.id === placeholderId ? {
            ...m,
            chart: {
              chartType: analyticsResult.chartType,
              title: analyticsResult.title,
              description: analyticsResult.description,
              data: normalized,
              isLoading: false,
              error: null,
            },
          } : m));
        } else {
          setAnalyticsMessages(prev => prev.map(m => m.id === placeholderId ? {
            ...m,
            content: "I couldn't generate a query for that. Try rephrasing your question.",
            chart: null,
          } : m));
        }
      } catch (err) {
        setAnalyticsMessages(prev => prev.map(m => m.id === placeholderId ? {
          ...m,
          chart: {
            ...m.chart!,
            isLoading: false,
            error: 'Failed to query subgraph. The subgraph may not be deployed yet.',
          },
        } : m));
      }
      return;
    }

    const command = classifyQuery(inputValue);

    // Reset modals helper
    const resetModals = () => {
       setShowSwap(false);
       setShowLiquidity(false);
       setShowAgentBuilder(false);
       setShowAddLiquidityModal(false);
       setShowPortfolioModal(false);
    };

    if (command.type === 'newChat') {
       resetModals();
       setAnalyticsMessages([]);
       setCurrentSessionId(null);
       setHasInteracted(false);
       setInputValue('');
       return;
    }

    if (command.type === 'addLiquidity') {
       resetModals();
       if (command.params?.tokenA || command.params?.tokenB) {
         setLiquidityInitialTokens({ tokenA: command.params.tokenA, tokenB: command.params.tokenB });
       } else {
         setLiquidityInitialTokens(null);
       }
       setShowAddLiquidityModal(true);
       sendMessage(inputValue);
       return;
    }

    if (command.type === 'liquidityList') {
       resetModals();
       setShowLiquidity(true);
       sendMessage(inputValue);
       return;
    }

    if (command.type === 'agent') {
       resetModals();
       setShowAgentBuilder(true);
       sendMessage(inputValue);
       return;
    }

    if (command.type === 'portfolio') {
        resetModals();
        if (inputValue.toLowerCase().includes('agent')) {
            setPortfolioType('Agent');
        } else {
            setPortfolioType('User');
        }
        setShowPortfolioModal(true);
        sendMessage(inputValue);
        return;
    }

    if (command.type === 'balance') {
        resetModals();
        // Build a balance summary from on-chain data
        const ethBal = ethBalanceData
          ? `${parseFloat(ethBalanceData.formatted).toFixed(4)} ETH`
          : null;
        const topTokens = tokenBalances
          .filter(b => parseFloat(b.formatted) > 0)
          .slice(0, 5)
          .map(b => `${b.formatted.slice(0, 8)} ${b.token.symbol}`);
        const lines = [ethBal, ...topTokens].filter(Boolean);
        const chainName = currentChain?.name ?? 'the current network';
        const balanceSummary = lines.length
          ? `Your current balances on ${chainName}:\n${lines.join('\n')}`
          : `No token balances found for this wallet on ${chainName}.`;
        // Inject a synthetic assistant message directly (no AI round-trip needed)
        setAnalyticsMessages(prev => [
          ...prev,
          {
            id: 'user-bal-' + Date.now(),
            sessionId: '',
            role: 'user' as const,
            content: inputValue,
            createdAt: new Date().toISOString(),
          },
          {
            id: 'asst-bal-' + Date.now(),
            sessionId: '',
            role: 'assistant' as const,
            content: balanceSummary,
            createdAt: new Date().toISOString(),
          },
        ]);
        setHasInteracted(true);
        return;
    }

    if (command.type === 'swap') {
      resetModals();
      setSwapDetails(command.params);
      setShowSwap(true);
      sendMessage(inputValue);
      return;
    }

    // All other queries (price, volume, comparison, performance, tvl, general) go to the AI chat
    sendMessage(inputValue);
  };

  return (
    <>
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif', background: theme.bgSecondary, color: theme.textPrimary, transition: 'all 0.3s ease' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        input::placeholder { color: ${theme.textMuted}; }
      `}</style>

      {/* Sidebar */}
      <aside style={{ width: sidebarOpen ? 260 : 0, minHeight: '100vh', background: theme.bgSidebar, borderRight: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.3s ease' }}>
        <div style={{ padding: '16px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* New Chat */}
          <button
            onClick={() => {
              setShowSwap(false);
              setShowLiquidity(false);
              setShowAgentBuilder(false);
              setShowPortfolioModal(false);
              setShowAddLiquidityModal(false);
              setHasInteracted(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '10px 12px',
              background: 'transparent',
              border: 'none',
              borderRadius: 8,
              color: theme.accent,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: 8,
            }}
          >
            <MessageSquarePlusIcon /> New Chat
          </button>

          {/* Swap */}
          <button
            onClick={() => {
              setShowSwap(true);
              setShowLiquidity(false);
              setShowAgentBuilder(false);
              setShowPortfolioModal(false);
              setShowAddLiquidityModal(false);
              setSwapDetails(null);
              setHasInteracted(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 8, color: theme.textPrimary, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            <ArrowLeftRightIcon /> Swap
          </button>

          {/* Liquidity */}
          <button
            onClick={() => {
              setShowLiquidity(true);
              setShowSwap(false);
              setShowAgentBuilder(false);
              setShowPortfolioModal(false);
              setShowAddLiquidityModal(false);
              setHasInteracted(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 8, color: theme.textPrimary, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            <DropletsIcon /> Liquidity
          </button>

          {/* Agent */}
          <button
            onClick={() => {
              setShowAgentBuilder(true);
              setShowSwap(false);
              setShowLiquidity(false);
              setShowPortfolioModal(false);
              setShowAddLiquidityModal(false);
              setHasInteracted(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: showAgentBuilder ? `${theme.accent}20` : 'transparent', border: 'none', borderRadius: 8, color: showAgentBuilder ? theme.accent : theme.textPrimary, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            <BotIcon /> Agent
          </button>

          {/* Portfolio */}
          <div style={{ marginBottom: 8 }}>
            <button
              onClick={() => setPortfolioOpen(!portfolioOpen)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 8, color: theme.textPrimary, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><WalletIcon /> Portfolio</span>
              {portfolioOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </button>
            {portfolioOpen && (
              <div style={{ paddingLeft: 20, marginTop: 4 }}>
                <button
                  onClick={() => {
                    setPortfolioType('User');
                    setShowPortfolioModal(true);
                    setHasInteracted(true);
                    setShowSwap(false);
                    setShowLiquidity(false);
                    setShowAgentBuilder(false);
                    setShowAddLiquidityModal(false);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: 6, color: theme.textSecondary, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                >
                  User Portfolio
                </button>
                <button
                  onClick={() => {
                    setPortfolioType('Agent');
                    setShowPortfolioModal(true);
                    setHasInteracted(true);
                    setShowSwap(false);
                    setShowLiquidity(false);
                    setShowAgentBuilder(false);
                    setShowAddLiquidityModal(false);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: 6, color: theme.textSecondary, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                >
                  Agent Portfolio
                </button>
              </div>
            )}
          </div>

          {/* Faucet removed — use Agent → Get Testnet Funds */}

          {/* Recent Chats */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', color: theme.textMuted, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <MessageSquareIcon /> Recent Chats
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px 8px 4px' }}>
              {isConnected && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 4px' }}>
                  {recentChats.map((chat, i) => (
                    <RecentChatItem
                      key={chat.id || i}
                      chat={chat}
                      theme={theme}
                      onDelete={async () => {
                        try {
                          await fetch(`/api/chat/sessions/${chat.id}`, { method: 'DELETE' });
                          loadRecentChats();
                        } catch (error) {
                          console.error('Failed to delete chat:', error);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: theme.bgPrimary, borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'transparent', border: 'none', padding: 8, cursor: 'pointer', color: theme.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MenuIcon />
            </button>
            <div onClick={() => setLocation('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <img src={isDark ? logoBlack : logoWhite} alt="Mantua.AI" style={{ height: 32 }} />
              <span style={{ fontFamily: '"Outfit", sans-serif', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>Mantua.AI</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setIsDark(!isDark)} style={{ background: 'transparent', border: 'none', padding: 8, cursor: 'pointer', color: theme.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>

            <ConnectButton />
          </div>
        </header>

        {/* Main Content Area */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: theme.bgPrimary, overflow: 'hidden', position: 'relative' }}>
          
          {/* Portfolio Overlay */}
          {showPortfolioModal && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 150, // Higher than other modals
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}>
                <PortfolioInterface
                  type={portfolioType}
                  onClose={() => setShowPortfolioModal(false)}
                  theme={theme}
                  isDark={isDark}
                  isConnected={isConnected}
                  currentChain={currentChain}
                  onRemoveLiquidity={(pool) => {
                    setSelectedPool({ token1: pool.token1, token2: pool.token2 });
                    setAddLiquidityMode('remove');
                    setShowPortfolioModal(false);
                    setShowAddLiquidityModal(true);
                    setHasInteracted(true);
                  }}
                />
            </div>
          )}

          {isConnected ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
              
              {/* Chat Container - Scrollable */}
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                overflowY: 'auto', 
                padding: '40px 20px 140px' // Bottom padding for fixed input
              }}>
                <div style={{ width: '100%', maxWidth: (showSwap || showLiquidity || showAddLiquidityModal) ? '1200px' : 700, transition: 'max-width 0.3s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
                  {!hasInteracted && !showSwap && !showLiquidity && !showAgentBuilder && (
                    <div style={{ textAlign: 'center' }}>
                      <h1 style={{ fontFamily: '"Outfit", sans-serif', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 600, marginBottom: 12, letterSpacing: '-0.02em' }}>Hi, {truncatedAddress || 'there'}</h1>
                      <p style={{ fontSize: 16, color: theme.textSecondary }}>What can I help you with today?</p>
                    </div>
                  )}

                  <ChatMessageList
                    messages={allMessages}
                    isLoading={chatIsLoading}
                    isDark={isDark}
                    theme={theme}
                  />

                  {/* Swap Overlay - centered within content area */}
                  {showSwap && !showLiquidity && !showAgentBuilder && (
                    <div style={{
                      width: '100%',
                      marginTop: 20,
                      marginBottom: 20,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <SwapInterface
                        onClose={() => setShowSwap(false)}
                        swapDetails={swapDetails}
                        theme={theme}
                        isDark={isDark}
                        onActionComplete={async (title) => { await updateSessionTitle(title); loadRecentChats(); }}
                      />
                    </div>
                  )}

                  {/* Liquidity Overlay */}
                  {showLiquidity && !showSwap && !showAgentBuilder && !showAddLiquidityModal && (
                    <div style={{ width: '100%', marginTop: 20, marginBottom: 20 }}>
                      <LiquidityInterface 
                        onClose={() => setShowLiquidity(false)} 
                        theme={theme} 
                        isDark={isDark} 
                        onAddLiquidity={(pool) => {
                           setSelectedPool(pool);
                           setAddLiquidityMode('add');
                           setShowLiquidity(false);
                           setShowAddLiquidityModal(true);
                        }}
                        onCreatePool={() => {
                           setSelectedPool(null);
                           setAddLiquidityMode('create');
                           setShowLiquidity(false);
                           setShowAddLiquidityModal(true);
                        }}
                      />
                    </div>
                  )}

                  {/* Add Liquidity Modal Overlay */}
                  {showAddLiquidityModal && !showSwap && !showAgentBuilder && !showLiquidity && (
                    <div style={{ width: '100%', marginTop: 20, marginBottom: 20, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                      <AddLiquidityModal
                        onClose={() => { setShowAddLiquidityModal(false); setSelectedPool(null); setLiquidityInitialTokens(null); }}
                        theme={theme}
                        isDark={isDark}
                        pool={selectedPool}
                        mode={addLiquidityMode}
                        initialTokenA={liquidityInitialTokens?.tokenA}
                        initialTokenB={liquidityInitialTokens?.tokenB}
                      />
                    </div>
                  )}

                  {/* Agent Builder Overlay */}
                  {showAgentBuilder && !showSwap && !showLiquidity && !showAddLiquidityModal && (
                    <div style={{ width: '100%', marginTop: 20, marginBottom: 20 }}>
                      <AgentBuilderInterface
                        onClose={() => setShowAgentBuilder(false)}
                        theme={theme}
                        isDark={isDark}
                        onNavigate={(view) => {
                          setShowAgentBuilder(false);
                          setHasInteracted(true);
                          if (view === 'swap') setShowSwap(true);
                          if (view === 'liquidity') setShowLiquidity(true);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Fixed Chat Input Area */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '20px 40px 40px',
                background: `linear-gradient(to top, ${theme.bgPrimary} 80%, transparent)`,
                zIndex: 100,
                display: 'flex',
                justifyContent: 'center'
              }}>
                <div style={{ width: '100%', maxWidth: 700, background: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '16px 20px', boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <ChatInput
                    onSubmit={handleChatSubmit}
                    disabled={isSending}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <ChainSelector
                      selectedChain={selectedChain}
                      chains={SUPPORTED_CHAINS}
                      onSelect={handleChainSwitch}
                      theme={theme}
                      isDark={isDark}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} />
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
              <div style={{ textAlign: 'center', maxWidth: 500 }}>
                <h1 style={{ fontFamily: '"Outfit", sans-serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600, marginBottom: 16, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  Meet Mantua.AI,<br />your personal DeFi Assistant
                </h1>
                <p style={{ fontSize: 16, color: theme.textSecondary }}>Connect your wallet to get started</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>

    {/* Voice feature removed in v2 */}
    </>
  );
}
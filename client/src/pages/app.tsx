// @ts-nocheck
/**
 * Mantua.AI App Home Page
 * 
 * Main application interface with sidebar navigation, wallet connection,
 * chat interface, and swap functionality for DeFi interactions.
 */

import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { useLocation } from 'wouter';
import { useAccount, useBalance, useSwitchChain } from 'wagmi';
import logoWhite from '@assets/Mantua_logo_white_1768946648374.png';
import logoBlack from '@assets/Mantua_logo_black_1768946648374.png';
import AnalysisCard from '../components/chat/AnalysisCard';
import { ChatMessageList } from '../components/chat/ChatMessageList';
import { ChatInput } from '../components/chat/ChatInput';
import { useChat } from '../hooks/useChat';
import AddLiquidityModal from '../components/liquidity/AddLiquidityModal';
import PushToTalkButton from '../components/voice/PushToTalkButton';
import VoiceConfirmationModal from '../components/voice/VoiceConfirmationModal';
import { parseVoiceCommand } from '@shared/voiceCommandParser';
import { FaucetButton } from '../components/FaucetButton';
import { classifyQuery } from '../utils/queryClassifier';
import { TrendingUp, BarChart2, PieChart as PieIcon, Activity, Layers } from 'lucide-react';
import { isAnalyticsQuery, generateAnalyticsQuery } from '../lib/analyticsEngine';
import { gqlQuery } from '../lib/graphql';
import { normalizeForChart } from '../lib/normalizeSubgraphData';
// Heavy views loaded lazily for bundle splitting
const PredictionsView   = lazy(() => import('../components/predictions/PredictionsView').then(m => ({ default: m.PredictionsView })));
const VaultsView        = lazy(() => import('../components/vaults/VaultsView').then(m => ({ default: m.VaultsView })));
import { TxHistoryPanel }  from '../components/portfolio/TxHistoryPanel';
import { useTxHistory }    from '../hooks/useTxHistory';
import { sanitizeInput }   from '../lib/sanitize';
import { trackEvent }      from '../lib/trackEvent';
import { ConnectButton } from '../components/wallet/ConnectButton';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { useTokenApproval } from '../hooks/useTokenApproval';
import { useSwapQuote, getPriceImpactSeverity } from '../hooks/useSwapQuote';
import { useSwapExecution } from '../hooks/useSwapExecution';
import { useTokenBalances } from '../hooks/useTokenBalances';
import { PriceImpact, SwapButton, SwapButtonStyles, SwapConfirmation, SwapPriceChart } from '../components/swap';
import { parseTokenAmount, formatTokenAmount, isNativeEth, getZeroAddress, getHookAddress } from '../lib/swap-utils';
import { ALL_TOKENS, NATIVE_ETH } from '../config/tokens';
import {
  getPriceData,
  getVolumeData,
  getComparisonData,
  getPortfolioData,
  getPerformanceData,
  getTVLData
} from '../utils/mockAnalyticsData';
import { calculateUsdValue as calcUsdValue, getPriceBySymbol } from '../services/priceService';
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
  SettingsIcon,
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


// Token icon component
const TokenIcon = ({ token, size = 32 }) => {
  const baseToken = token.startsWith('m') && token.length > 1 && /^[A-Z]/.test(token[1]) ? token.substring(1) : token;
  
  const getTokenColor = (t) => {
    const colors = {
      'ETH': 'linear-gradient(135deg, #627EEA 0%, #8B9FFF 100%)',
      'USDC': 'linear-gradient(135deg, #2775CA 0%, #4A9FE8 100%)',
      'USDT': 'linear-gradient(135deg, #26A17B 0%, #4DB193 100%)',
      'DAI': 'linear-gradient(135deg, #F5AC37 0%, #FFD166 100%)',
      'BTC': 'linear-gradient(135deg, #F7931A 0%, #FFAB4A 100%)',
      'WBTC': 'linear-gradient(135deg, #F7931A 0%, #FFAB4A 100%)',
      'LINK': 'linear-gradient(135deg, #2A5ADA 0%, #5480F0 100%)',
      'UNI': 'linear-gradient(135deg, #FF007A 0%, #FF4D9E 100%)',
      'AAVE': 'linear-gradient(135deg, #B6509E 0%, #D485C2 100%)',
      'LP': 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
    };
    return colors[t] || 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)';
  };

  const getTokenSymbol = (t) => {
    if (t === 'ETH') return 'Ξ';
    if (t === 'USDC' || t === 'USDT' || t === 'DAI') return '$';
    if (t === 'BTC' || t === 'WBTC') return '₿';
    if (t === 'LINK') return '⬡';
    if (t === 'UNI') return '🦄';
    if (t === 'LP') return '◈';
    return t.charAt(0);
  };

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: getTokenColor(baseToken),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.45,
      fontWeight: '600',
      color: 'white',
    }}>
      {getTokenSymbol(baseToken)}
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
    'Stable Protection': { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
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

// ============ PORTFOLIO INTERFACE ============
const PortfolioInterface = ({ onClose, type, theme, isDark, isConnected, currentChain, onRemoveLiquidity }) => {
  const [activityFilter, setActivityFilter] = useState('All');
  const [showHistory, setShowHistory] = useState(false);

  // Mock data tailored for empty/filled states based on requirements
  const isAgent = type === 'Agent';
  const hasData = !isAgent && isConnected;

  const portfolioData = hasData ? {
    totalValue: 12450.25,
    ethBalance: 3.245,
    ethPrice: 3245.50,
    usdcBalance: 1850.45,
    lpPositions: 2,
    lpValue: 4250.80,
    netPnl: 12.5,
    netPnlUsd: 1450.20
  } : {
    totalValue: 0,
    ethBalance: 0,
    ethPrice: 0,
    usdcBalance: 0,
    lpPositions: 0,
    lpValue: 0,
    netPnl: 0,
    netPnlUsd: 0
  };

  const assets = hasData ? [
    { name: 'Ethereum', symbol: 'ETH', balance: 3.245, usdValue: 10531.64, percentage: 84.5 },
    { name: 'USD Coin', symbol: 'USDC', balance: 1850.45, usdValue: 1850.45, percentage: 14.8 },
  ] : [];

  const liquidityPositions = hasData ? [
    { token1: 'ETH', token2: 'USDC', status: 'Active', hookName: 'None', tvl: 2450.50, feesEarned: 124.50, feeTier: 0.05, rangeLow: 2800, rangeHigh: 3600 }
  ] : [];

  const activities = hasData ? [
    { type: 'Swap', status: 'Completed', description: 'Swapped ETH for USDC', initiator: 'User', timestamp: '2 mins ago', txHash: '0x123...abc', amount: '1.2 ETH', amountUsd: '3,894.50' },
    { type: 'Add Liquidity', status: 'Completed', description: 'Added liquidity to ETH/USDC', initiator: 'User', timestamp: '4 hours ago', txHash: '0x456...def', amount: '2.5 ETH', amountUsd: '8,113.75' },
  ] : [];

  return (
    <div style={{ width: '100%', fontFamily: '"DM Sans", sans-serif' }}>
      <div style={{
        background: theme.bgSecondary,
        borderRadius: '16px',
        border: `1px solid ${theme.border}`,
        padding: '24px',
        maxHeight: '85vh',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
           <h1 style={{ margin: 0, fontSize: '24px', color: theme.textPrimary }}>{type} Portfolio</h1>
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <button
               onClick={() => setShowHistory(h => !h)}
               style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '600', borderRadius: '8px', border: `1px solid ${theme.border}`, background: showHistory ? `${theme.accent}20` : 'transparent', color: showHistory ? theme.accent : theme.textSecondary, cursor: 'pointer' }}
             >
               {showHistory ? 'Hide History' : 'Tx History'}
             </button>
             <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', color: theme.textSecondary }}>
               <CloseIcon />
             </button>
           </div>
        </div>

        {showHistory ? (
          <div style={{ background: theme.bgCard, borderRadius: '16px', border: `1px solid ${theme.border}`, minHeight: '300px', marginBottom: '24px' }}>
            <TxHistoryPanel />
          </div>
        ) : (
          <>
            <PortfolioSummary data={portfolioData} theme={theme} currentChain={currentChain} />
            <AssetsTable assets={assets} theme={theme} />
            <LiquidityPositions positions={liquidityPositions} theme={theme} onRemoveLiquidity={onRemoveLiquidity} />
            <ActivityFeed activities={activities} filter={activityFilter} setFilter={setActivityFilter} theme={theme} />
          </>
        )}
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
const TokenSelectModal = ({ isOpen, onClose, onSelect, theme, isDark, getTokenBalance, calculateUsdValue }) => {
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
    category: token.category,
    // Add icon based on symbol
    icon: token.symbol.includes('ETH') || token.symbol === 'ETH' ? 'Ξ'
      : token.symbol.includes('USDC') || token.symbol.includes('USDT') || token.symbol.includes('USD') ? '$'
      : token.symbol.includes('DAI') ? '◇'
      : token.symbol.includes('FRAX') ? 'F'
      : token.symbol.includes('OUSG') ? 'O'
      : token.symbol.includes('USDY') ? 'Y'
      : token.symbol.includes('BUIDL') ? 'B'
      : token.symbol.includes('TBILL') ? 'T'
      : token.symbol.includes('STEUR') ? '€'
      : token.symbol.includes('BTC') ? '₿'
      : token.symbol.includes('SOL') ? 'S'
      : token.symbol.includes('AVAX') ? 'A'
      : token.symbol.includes('MATIC') ? 'M'
      : '◆',
  }));

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'stablecoin', label: 'Stables' },
    { id: 'rwa', label: 'RWAs' },
    { id: 'lst', label: 'LSTs' },
    { id: 'wrapped', label: 'Wrapped' },
  ];

  // Filter tokens by category and search
  const filteredTokens = allTokens.filter(token => {
    const matchesCategory = selectedCategory === 'all' || token.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getTokenIcon = (token) => {
    const symbol = token.symbol;
    
    // Color mapping for different token types
    const colorMap = {
      ETH: 'linear-gradient(135deg, #627EEA 0%, #8B9FFF 100%)',
      mUSDC: 'linear-gradient(135deg, #2775CA 0%, #4A9FE8 100%)',
      mUSDT: 'linear-gradient(135deg, #26A17B 0%, #50C878 100%)',
      mDAI: 'linear-gradient(135deg, #F5AC37 0%, #FFD166 100%)',
      mUSDe: 'linear-gradient(135deg, #2775CA 0%, #4A9FE8 100%)',
      mFRAX: 'linear-gradient(135deg, #000000 0%, #333333 100%)',
      mOUSG: 'linear-gradient(135deg, #1a237e 0%, #3949ab 100%)',
      mUSDY: 'linear-gradient(135deg, #2775CA 0%, #4A9FE8 100%)',
      mBUIDL: 'linear-gradient(135deg, #000000 0%, #333333 100%)',
      mTBILL: 'linear-gradient(135deg, #26A17B 0%, #50C878 100%)',
      mSTEUR: 'linear-gradient(135deg, #FF6B35 0%, #F7931A 100%)',
      mstETH: 'linear-gradient(135deg, #00A3FF 0%, #5AC8FA 100%)',
      mcbETH: 'linear-gradient(135deg, #0052FF 0%, #3B7BF7 100%)',
      mrETH: 'linear-gradient(135deg, #FF6B35 0%, #F7931A 100%)',
      mwstETH: 'linear-gradient(135deg, #00A3FF 0%, #5AC8FA 100%)',
      mWBTC: 'linear-gradient(135deg, #F7931A 0%, #FFAB4A 100%)',
      mWETH: 'linear-gradient(135deg, #627EEA 0%, #8B9FFF 100%)',
      mWSOL: 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)',
      mWAVAX: 'linear-gradient(135deg, #E84142 0%, #FF6B6B 100%)',
      mWMATIC: 'linear-gradient(135deg, #8247E5 0%, #A47AE8 100%)',
      mBTC: 'linear-gradient(135deg, #F7931A 0%, #FFAB4A 100%)',
    };

    const background = colorMap[symbol] || 'linear-gradient(135deg, #627EEA 0%, #8B9FFF 100%)';

    return (
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        fontWeight: '700',
        color: 'white',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        {token.icon}
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
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: theme.textPrimary }}>Swap From Token</h3>
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

const TokenSelect = ({ token, tokenData, balance, usdValue, side, amount, theme, onTokenClick, onAmountChange }) => {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ color: theme ? theme.textSecondary : '#6b7280', fontSize: '14px', fontWeight: '500' }}>{side}</span>
        <span style={{ color: theme ? theme.textMuted : '#9ca3af', fontSize: '13px' }}>Balance: {balance || '0.00'}</span>
      </div>
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
              : tokenSymbol.includes('USDC')
                ? 'linear-gradient(135deg, #2775CA 0%, #4A9FE8 100%)'
                : tokenSymbol.includes('DAI')
                  ? 'linear-gradient(135deg, #F5AC37 0%, #FFD166 100%)'
                  : tokenSymbol.includes('BTC')
                    ? 'linear-gradient(135deg, #F7931A 0%, #FFAB4A 100%)'
                    : tokenSymbol.includes('LINK')
                      ? 'linear-gradient(135deg, #2A5ADA 0%, #5480F0 100%)'
                      : 'linear-gradient(135deg, #9ca3af 0%, #d1d5db 100%)',
            display: tokenLogoURI ? 'none' : 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: tokenSymbol.includes('ETH') ? '16px' : '12px',
            fontWeight: '700',
            color: 'white',
          }}>
            {tokenSymbol.includes('ETH') ? 'Ξ' :
             tokenSymbol.includes('USDC') ? '$' :
             tokenSymbol.includes('DAI') ? '◈' :
             tokenSymbol.includes('BTC') ? '₿' :
             tokenSymbol.includes('LINK') ? '⬡' : '?'}
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
          ${getPriceBySymbol(tokenSymbol).toFixed(2)}
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
                  Based on your stablecoin swap, we recommend <span style={{ fontWeight: '600', color: '#3b82f6' }}>Stable Protection</span> to guard against depeg events.
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
                      <div style={{ fontSize: '14px', fontWeight: '500', color: theme.textPrimary }}>Stable Protection Hook</div>
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
const SwapInterface = ({ onClose, swapDetails, theme, isDark }) => {
  const { isConnected, address } = useAccount();
  const { openModal } = useWalletConnection();
  const [selectedHook, setSelectedHook] = useState(swapDetails?.hook || 'sp');
  const [isHookModalOpen, setIsHookModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [slippageTolerance] = useState(0.5);

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
  const [toToken, setToToken] = useState(swapDetails?.toToken || "mUSDC");
  const [fromAmount, setFromAmount] = useState(swapDetails?.fromAmount || "");
  const [toAmount, setToAmount] = useState(swapDetails?.toAmount || ""); 

  // Find token data from ALL_TOKENS
  const fromTokenData = useMemo(() => {
    return ALL_TOKENS.find(t => t.symbol === fromToken || t.symbol === `m${fromToken}`) || NATIVE_ETH;
  }, [fromToken]);

  const toTokenData = useMemo(() => {
    return ALL_TOKENS.find(t => t.symbol === toToken || t.symbol === `m${toToken}`) || ALL_TOKENS[1];
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

  // Update toAmount when quote changes
  useEffect(() => {
    if (quote && quote.outputAmount > BigInt(0)) {
      setToAmount(formatTokenAmount(quote.outputAmount, toTokenData.decimals));
    } else if (!fromAmount) {
      setToAmount('');
    }
  }, [quote, fromAmount, toTokenData.decimals]);
  
  // Update local state when props change
  useEffect(() => {
     if (swapDetails) {
        setFromToken(swapDetails.fromToken || "ETH");
        setToToken(swapDetails.toToken || "mUSDC");
        setFromAmount(swapDetails.fromAmount || "");
        setToAmount(swapDetails.toAmount || "");
     }
  }, [swapDetails]);

  // Handle swap execution
  const handleSwap = async () => {
    if (!isConnected || !quote) return;
    
    setShowConfirmation(true);
    await executeSwap({
      tokenIn: fromTokenData.address,
      tokenOut: toTokenData.address,
      amountIn: parsedAmount,
      hookAddress: getHookAddress(selectedHook),
      hookId: selectedHook,
    });
  };

  const handleCloseConfirmation = () => {
    setShowConfirmation(false);
    if (swapStatus === 'confirmed') {
      setFromAmount('');
      setToAmount('');
      resetSwap();
    }
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
    { id: 'sp', name: 'Stable Protection', abbr: 'SP', description: 'Peg monitoring and depeg circuit breaker for stablecoins', icon: <LockIcon />, benefit: 'Protects against depeg events', recommended: true },
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
              Auto-selected <span style={{ color: '#3b82f6', fontWeight: '600' }}>Stable Protection</span> for safer stablecoin swaps
            </div>
          </div>
          <div style={{ paddingRight: '10px' }}>
             <MiniChart data={[3200, 3180, 3220, 3250, 3230, 3280, 3245]} color="#8b5cf6" />
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
              <button style={{ background: 'transparent', border: 'none', color: theme.textMuted, cursor: 'pointer', padding: '8px', borderRadius: '50%' }}>
                <SettingsIcon />
              </button>
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
            />
            
            <div style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)', 
              zIndex: 10 
            }}>
              <button style={{
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
              }}>
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
          <div style={{ marginTop: '12px', padding: '12px 16px', background: theme.bgSecondary, borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
              <span style={{ color: theme.textSecondary }}>Rate</span>
              <span style={{ color: theme.textPrimary, fontWeight: '500' }}>1 ETH = 3,245.50 USDC</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
              <span style={{ color: theme.textSecondary }}>Network Fee</span>
              <span style={{ color: theme.textPrimary, fontWeight: '500' }}>~$2.45</span>
            </div>
            
            <div style={{ borderTop: `1px solid ${theme.border}`, margin: '8px 0', padding: '8px 0' }}>
              <div style={{ color: theme.textSecondary, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>Fee Architecture</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                <span style={{ color: theme.textMuted }}>LP Fee</span>
                <span style={{ color: theme.textPrimary }}>0.05%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                <span style={{ color: theme.textMuted }}>Protocol Fee</span>
                <span style={{ color: theme.textPrimary }}>0.00%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: theme.textMuted }}>Hook Fee</span>
                <span style={{ color: theme.textPrimary }}>0.01%</span>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: theme.textSecondary }}>Price Impact</span>
                <span style={{ 
                  color: quote ? (quote.priceImpact < 1 ? '#10b981' : quote.priceImpact < 5 ? '#f59e0b' : '#ef4444') : '#10b981',
                  fontWeight: quote && quote.priceImpact >= 5 ? '700' : '500'
                }}>
                  {quote ? `${quote.priceImpact.toFixed(2)}%` : '<0.01%'}
                  {quote && quote.priceImpact >= 5 && ' ⚠️'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: theme.textSecondary }}>Max Slippage</span>
                <span style={{ color: theme.textPrimary }}>{slippageTolerance}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: theme.textSecondary }}>Min. Received</span>
                <span style={{ color: theme.textPrimary }}>
                  {quote ? `${formatTokenAmount(quote.minimumReceived, toTokenData.decimals)} ${toToken}` : '-'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: theme.textSecondary }}>Hook Benefit</span>
                <span style={{ color: '#10b981', fontWeight: '700' }}>+$14.60 saved</span>
              </div>
            </div>
          </div>

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
              onApprove={() => approve(true)}
              onSwap={handleSwap}
              disabled={isExecuting || !quote}
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
  
  const pools = [
    { 
      token1: 'mUSDC', token2: 'mUSDT', type: 'Stable', hook: 'Stable Protection',
      volume: 80.55, fees: 0.40, liquidity: 971950.29, yield: '0.01'
    },
    {
      token1: 'mUSDC', token2: 'mDAI', type: 'Stable', hook: 'Stable Protection',
      volume: 0.00, fees: 0.00, liquidity: 4040.35, yield: '0.00'
    },
    {
      token1: 'ETH', token2: 'mUSDC', type: 'Standard', hook: 'None',
      volume: 59199.58, fees: 19.60, liquidity: 318789.34, yield: '2.24'
    },
    {
      token1: 'mWBTC', token2: 'mUSDC', type: 'Standard', hook: 'None',
      volume: 4500.00, fees: 12.50, liquidity: 368081.08, yield: '1.85'
    },
    {
      token1: 'mstETH', token2: 'ETH', type: 'Standard', hook: 'None',
      volume: 3195.71, fees: 1.20, liquidity: 1500.96, yield: '29.14'
    },
    {
      token1: 'mcbETH', token2: 'ETH', type: 'Standard', hook: 'None',
      volume: 4366.80, fees: 1.69, liquidity: 370896.77, yield: '0.17'
    },
    {
      token1: 'mrETH', token2: 'ETH', type: 'Standard', hook: 'None',
      volume: 1250.00, fees: 0.85, liquidity: 24750.85, yield: '1.12'
    },
    {
      token1: 'mOUSG', token2: 'mUSDC', type: 'Standard', hook: 'Stable Protection',
      volume: 15780.25, fees: 8.45, liquidity: 125000.00, yield: '3.45'
    },
    {
      token1: 'mBUIDL', token2: 'mUSDC', type: 'Standard', hook: 'Stable Protection',
      volume: 8500.00, fees: 4.25, liquidity: 85000.00, yield: '2.15'
    },
  ];

  const hookOptions = ['All', 'Stable Protection', 'None'];
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
      'Stable Protection': { icon: <LockIcon />, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
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
            <span style={{ color: theme.accent, fontWeight: '600' }}>Showing {filteredPools.length} liquidity pools</span>
            {' '}• Pools with <strong>Stable Protection</strong> hooks help guard against stablecoin depeg events. 
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
          <StatsCard label="TVL [Testnet]" value={`$${totalTVL.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} change="+12.5%" />
          <StatsCard label="Volume 24H [Testnet]" value={`$${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} change="+8.3%" />
          <StatsCard label="Fees 24H [Testnet]" value={`$${totalFees.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} change="+5.2%" />
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
              {filteredPools.map((pool, i) => (
                <tr key={i} style={{ borderBottom: i === filteredPools.length - 1 ? 'none' : `1px solid ${theme.border}` }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <TokenPairIcon token1={pool.token1} token2={pool.token2} size={24} />
                      <div>
                        <div style={{ color: theme.textPrimary, fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>{pool.token1} / {pool.token2}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          <PoolTypeBadge type={pool.type} />
                          <HookBadge hook={pool.hook} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}><span style={{ color: theme.textPrimary, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '13px' }}>${pool.volume.toLocaleString()}</span></td>
                  <td style={{ padding: '12px' }}><span style={{ color: theme.textPrimary, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '13px' }}>${pool.fees.toLocaleString()}</span></td>
                  <td style={{ padding: '12px' }}><span style={{ color: theme.textPrimary, fontFamily: 'SF Mono, Monaco, monospace', fontSize: '13px' }}>${pool.liquidity.toLocaleString()}</span></td>
                  <td style={{ padding: '12px' }}><YieldBadge value={pool.yield} /></td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                     <button onClick={() => onAddLiquidity(pool)} style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${theme.accent}40`, background: `${theme.accent}10`, color: theme.accent, fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', width: '100%' }}>Add Liquidity</button>
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

// Sub-panel: Wallet Management
const AgentWalletPanel = ({ theme, isDark, address, balance }) => {
  const [agentWalletAddress, setAgentWalletAddress] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const handleCreateWallet = async () => {
    setIsCreating(true);
    try {
      const res = await fetch('/api/agent/wallet', { method: 'POST' });
      const data = await res.json();
      if (data.address) {
        setAgentWalletAddress(data.address);
        setCreated(true);
      }
    } catch (e) {
      console.error('Failed to create agent wallet:', e);
    } finally {
      setIsCreating(false);
    }
  };

  const fieldStyle = {
    padding: '16px',
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    borderRadius: '10px',
    border: `1px solid ${theme.border}`,
    marginBottom: '12px',
  };

  return (
    <div style={{ padding: '24px', background: theme.bgCard, borderRadius: '14px', border: `1px solid ${theme.border}` }}>
      <h3 style={{ color: theme.textPrimary, fontSize: '16px', fontWeight: '600', marginBottom: '20px', margin: '0 0 20px 0' }}>Wallet Management</h3>
      <div style={fieldStyle}>
        <div style={{ fontSize: '11px', color: theme.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Connected Wallet</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '13px', color: theme.textPrimary }}>
            {address ? `${address.slice(0, 10)}...${address.slice(-8)}` : 'Not connected'}
          </div>
          <div style={{ fontSize: '14px', color: theme.textPrimary, fontWeight: '600' }}>
            {balance ? `${parseFloat(balance.formatted).toFixed(4)} ${balance.symbol}` : '—'}
          </div>
        </div>
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
          <span style={{ fontSize: '12px', color: '#10b981' }}>Active on Base Sepolia</span>
        </div>
      </div>

      <div style={fieldStyle}>
        <div style={{ fontSize: '11px', color: theme.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>AgentKit Wallet (CDP)</div>
        {created && agentWalletAddress ? (
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: '13px', color: theme.textPrimary, marginBottom: '8px' }}>
              {`${agentWalletAddress.slice(0, 10)}...${agentWalletAddress.slice(-8)}`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontSize: '12px', color: '#10b981' }}>Wallet created successfully</span>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '13px', color: theme.textMuted, marginBottom: '14px', lineHeight: '1.5' }}>
              Create a Coinbase Developer Platform managed wallet for autonomous onchain operations.
            </div>
            <button
              onClick={handleCreateWallet}
              disabled={isCreating}
              style={{ padding: '10px 22px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: '600', cursor: isCreating ? 'not-allowed' : 'pointer', opacity: isCreating ? 0.7 : 1 }}
            >
              {isCreating ? 'Creating...' : 'Create AgentKit Wallet'}
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.15)', fontSize: '12px', color: theme.textSecondary, lineHeight: '1.5' }}>
        💡 AgentKit wallets are server-managed via Coinbase CDP and can execute transactions autonomously without requiring manual signing.
      </div>
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

  const quickTokens = ['ETH', 'mUSDC', 'mUSDT', 'mDAI', 'mWBTC', 'mWETH'];

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

// Sub-panel: Onchain Analytics Query
const AgentAnalyticsPanel = ({ theme, isDark }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);

  const exampleQueries = ['Show ETH/USDC pool TVL', 'Top pools by volume today', 'Recent swap transactions', 'Token price history'];

  const handleQuery = async (q?: string) => {
    const queryText = q || query;
    if (!queryText) return;
    if (q) setQuery(q);
    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/agent/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: 'Failed to fetch analytics data' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', background: theme.bgCard, borderRadius: '14px', border: `1px solid ${theme.border}` }}>
      <h3 style={{ color: theme.textPrimary, fontSize: '16px', fontWeight: '600', margin: '0 0 20px 0' }}>Query Onchain Data</h3>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleQuery()}
          placeholder="Ask about pools, volumes, token prices..."
          style={{ flex: 1, padding: '12px 16px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', border: `1px solid ${theme.border}`, borderRadius: '8px', color: theme.textPrimary, fontSize: '14px', outline: 'none' }}
        />
        <button onClick={() => handleQuery()} disabled={!query || isLoading} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #06b6d4, #0891b2)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: '600', cursor: (!query || isLoading) ? 'not-allowed' : 'pointer', opacity: (!query || isLoading) ? 0.7 : 1, whiteSpace: 'nowrap' }}>
          {isLoading ? 'Querying...' : 'Query'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {exampleQueries.map(q => (
          <button key={q} onClick={() => handleQuery(q)} style={{ padding: '4px 12px', borderRadius: '14px', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textSecondary, fontSize: '12px', cursor: 'pointer' }}>
            {q}
          </button>
        ))}
      </div>
      {isLoading && <div style={{ padding: '20px', textAlign: 'center', color: theme.textMuted, fontSize: '14px' }}>Fetching onchain data...</div>}
      {result && !result.error && (
        <div style={{ padding: '16px', borderRadius: '10px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', border: `1px solid ${theme.border}`, maxHeight: '300px', overflowY: 'auto' }}>
          <pre style={{ color: theme.textPrimary, fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
      {result?.error && <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '13px' }}>{result.error}</div>}
    </div>
  );
};

// Sub-panel: Navigate card (swap / liquidity / bets)
const AgentNavPanel = ({ theme, title, description, features, cta, onNavigate, accentColor }) => (
  <div style={{ padding: '24px', background: theme.bgCard, borderRadius: '14px', border: `1px solid ${theme.border}` }}>
    <h3 style={{ color: theme.textPrimary, fontSize: '16px', fontWeight: '600', margin: '0 0 8px 0' }}>{title}</h3>
    <p style={{ color: theme.textSecondary, fontSize: '14px', lineHeight: '1.6', margin: '0 0 16px 0' }}>{description}</p>
    <div style={{ marginBottom: '20px' }}>
      {features.map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
          <span style={{ color: theme.textSecondary, fontSize: '13px' }}>{f}</span>
        </div>
      ))}
    </div>
    <button onClick={onNavigate} style={{ padding: '12px 24px', background: `linear-gradient(135deg, ${accentColor}dd, ${accentColor}99)`, border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
      {cta}
    </button>
  </div>
);

// Main AgentBuilder component
const AgentBuilderInterface = ({ onClose, theme, isDark, onNavigate }) => {
  const [activeAction, setActiveAction] = useState(null);
  const { address } = useAccount();
  const { data: balance } = useBalance({ address });

  const actions = [
    { id: 'wallet',    color: '#3b82f6', emoji: '💼', title: 'Create / Manage Wallet',     subtitle: 'CDP-managed wallets for autonomous agents', tag: null },
    { id: 'transfer',  color: '#10b981', emoji: '📤', title: 'Send Tokens',                subtitle: 'Transfer tokens to any address on Base',    tag: null },
    { id: 'swap',      color: '#f59e0b', emoji: '🔄', title: 'Swap Tokens',                subtitle: 'Execute swaps via Uniswap v4 hooks',        tag: null },
    { id: 'liquidity', color: '#8b5cf6', emoji: '💧', title: 'Add / Remove Liquidity',     subtitle: 'Manage LP positions across pools',          tag: null },
    { id: 'bets',      color: '#ef4444', emoji: '🎯', title: 'Place Bets',                 subtitle: 'Participate in prediction markets',         tag: 'NEW' },
    { id: 'analytics', color: '#06b6d4', emoji: '🔍', title: 'Query Onchain Data',         subtitle: 'Analyze on-chain metrics and pool data',    tag: null },
  ];

  const renderPanel = () => {
    switch (activeAction) {
      case 'wallet':
        return <AgentWalletPanel theme={theme} isDark={isDark} address={address} balance={balance} />;
      case 'transfer':
        return <AgentTransferPanel theme={theme} isDark={isDark} />;
      case 'swap':
        return (
          <AgentNavPanel
            theme={theme}
            title="Swap Tokens via AgentKit"
            description="Execute token swaps through Uniswap v4 with intelligent hook selection. The agent analyzes pool liquidity and routes through the optimal path automatically."
            features={['Automatic route optimization across liquidity pools', 'Support for 20+ tokens on Base Sepolia', 'Hook-aware swapping: ALO, TWAMM, Stable Protection', 'Real-time price impact analysis before execution']}
            cta="Open Swap Interface →"
            onNavigate={() => onNavigate('swap')}
            accentColor="#f59e0b"
          />
        );
      case 'liquidity':
        return (
          <AgentNavPanel
            theme={theme}
            title="Manage Liquidity Positions"
            description="Add or remove liquidity from Uniswap v4 pools with customizable tick ranges and hook configurations for enhanced yield strategies."
            features={['Full-range and concentrated liquidity support', 'Create new pools with custom hook configurations', 'Real-time APY estimates and fee projections', 'Yield-maximizing hooks for auto-compounding']}
            cta="Open Liquidity Interface →"
            onNavigate={() => onNavigate('liquidity')}
            accentColor="#8b5cf6"
          />
        );
      case 'bets':
        return (
          <AgentNavPanel
            theme={theme}
            title="Prediction Markets"
            description="Place bets on crypto, sports, politics, and real-world events. Powered by on-chain markets with transparent, trustless settlement."
            features={['Live prediction markets with real-time odds', 'On-chain settlement via smart contracts', 'Supports ETH and USDC for betting', 'Full market history, analytics, and leaderboards']}
            cta="Open Predictions →"
            onNavigate={() => onNavigate('predictions')}
            accentColor="#ef4444"
          />
        );
      case 'analytics':
        return <AgentAnalyticsPanel theme={theme} isDark={isDark} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ width: '100%', fontFamily: '"DM Sans", sans-serif' }}>
      {/* Header */}
      <div style={{ background: theme.bgCard, borderRadius: '16px', border: `1px solid ${theme.border}`, padding: '28px 32px', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '220px', height: '100%', background: 'linear-gradient(135deg, transparent, rgba(139, 92, 246, 0.06))', pointerEvents: 'none' }} />
        <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: theme.textMuted, cursor: 'pointer', padding: '8px', borderRadius: '50%', zIndex: 1 }}>
          <CloseIcon />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
            🤖
          </div>
          <div>
            <h1 style={{ color: theme.textPrimary, fontSize: '22px', fontWeight: '700', margin: '0 0 6px 0' }}>AgentKit</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', fontSize: '11px', fontWeight: '600' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6' }} /> Coinbase CDP
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '11px', fontWeight: '600' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} /> Base Sepolia
              </div>
            </div>
          </div>
        </div>
        <p style={{ color: theme.textSecondary, fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
          AI-powered agents that autonomously execute DeFi operations — wallet management, token transfers, swaps, liquidity provisioning, and more.
        </p>
      </div>

      {/* Action Cards Grid — 3 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: activeAction ? '20px' : '0' }}>
        {actions.map(action => {
          const isActive = activeAction === action.id;
          return (
            <button
              key={action.id}
              onClick={() => setActiveAction(isActive ? null : action.id)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '20px', background: isActive ? `${action.color}12` : theme.bgCard, border: `1.5px solid ${isActive ? action.color : theme.border}`, borderRadius: '14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = `${action.color}55`; e.currentTarget.style.background = `${action.color}08`; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.background = theme.bgCard; } }}
            >
              {action.tag && !isActive && (
                <span style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '9px', fontWeight: '700', background: '#7c3aed', color: 'white', padding: '2px 6px', borderRadius: '10px' }}>{action.tag}</span>
              )}
              {isActive && <div style={{ position: 'absolute', top: '12px', right: '12px', width: '8px', height: '8px', borderRadius: '50%', background: action.color }} />}
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${action.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '12px' }}>
                {action.emoji}
              </div>
              <div style={{ color: theme.textPrimary, fontWeight: '600', fontSize: '13px', marginBottom: '4px', lineHeight: '1.4' }}>{action.title}</div>
              <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: '1.4' }}>{action.subtitle}</div>
            </button>
          );
        })}
      </div>

      {/* Active Action Panel */}
      {activeAction && (
        <div>{renderPanel()}</div>
      )}
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

  // Chain configuration
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
      color: '#FF007A',
      rpcUrl: 'https://sepolia.unichain.org',
      blockExplorer: 'https://sepolia.uniscan.xyz',
    },
  };

  const [selectedChain, setSelectedChain] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mantua-selected-chain');
      if (saved && SUPPORTED_CHAINS[saved]) return saved;
    }
    return 'base-sepolia';
  });

  useEffect(() => {
    localStorage.setItem('mantua-selected-chain', selectedChain);
  }, [selectedChain]);

  const currentChain = SUPPORTED_CHAINS[selectedChain];

  // Real wallet connection using AppKit
  const { isConnected, address, truncatedAddress } = useWalletConnection();

  // Token balances (used for balance chat command)
  const { balances: tokenBalances, balancesBySymbol } = useTokenBalances();
  const { data: ethBalanceData } = useBalance({ address });

  // Chain switching hook
  const { switchChain } = useSwitchChain();

  // Handler to switch both wallet network AND UI state
  const handleChainSwitch = async (chainKey: string) => {
    const chain = SUPPORTED_CHAINS[chainKey];
    if (!chain) return;

    try {
      // Update UI state immediately for better UX
      setSelectedChain(chainKey);

      // If wallet is connected, switch the actual network
      if (isConnected && switchChain) {
        await switchChain({ chainId: chain.id });
      }
    } catch (error) {
      console.error('Failed to switch chain:', error);
      // Revert UI state if network switch failed
      const currentWalletChain = Object.entries(SUPPORTED_CHAINS).find(
        ([_, c]) => c.id === chain.id
      )?.[0];
      if (currentWalletChain) {
        setSelectedChain(currentWalletChain);
      }
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
  const [showPredictions,  setShowPredictions]  = useState(false);
  const [showVaults,       setShowVaults]       = useState(false);
  const [selectedPool, setSelectedPool] = useState(null);
  const [addLiquidityMode, setAddLiquidityMode] = useState<'add' | 'create' | 'remove'>('add');
  const [portfolioType, setPortfolioType] = useState('User');
  const [swapDetails, setSwapDetails] = useState(null);
  // Voice command state
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceParsedCommand, setVoiceParsedCommand] = useState(null);
  const isVoiceSubmitRef = useRef(false);
  // Persistent chat state from useChat hook
  const { messages: chatMessages, sendMessage, isSending, isLoading: chatIsLoading } = useChat();
  const [analyticsMessages, setAnalyticsMessages] = useState<any[]>([]);
  const allMessages = useMemo(() => {
    const combined = [...chatMessages, ...analyticsMessages];
    combined.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return combined;
  }, [chatMessages, analyticsMessages]);

  const walletAddress = truncatedAddress || '0xbaac...DC87';
  const walletBalance = '0.0021 ETH'; // TODO: Fetch real balance

  // Track wallet connection event
  useEffect(() => {
    if (isConnected && address) {
      trackEvent('wallet_connected', address);
    }
  }, [isConnected, address]);

  const [recentChats, setRecentChats] = useState([]);

  useEffect(() => {
    async function loadRecentChats() {
      try {
        const sessions = await fetch('/api/chat/sessions').then(res => res.json());
        setRecentChats(sessions);
      } catch (error) {
        console.error('Failed to load recent chats:', error);
      }
    }
    loadRecentChats();
  }, []);

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
        const balanceSummary = lines.length
          ? `Your current balances on Base Sepolia:\n${lines.join('\n')}`
          : 'No token balances found for this wallet on Base Sepolia.';
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

    // Check for Analytical Queries or General Chat
    if (command.type !== 'general' && command.type !== 'action') {
         let data = [];
         let title = '';
         let summary = '';
         let insights = [];
         let chartType: 'area' | 'bar' | 'pie' | 'line' = 'area';
         let icon = <TrendingUp size={20} />;
         
         const asset = command.assets[0] || 'ETH';
         
         switch(command.type) {
           case 'price':
             data = getPriceData(asset, command.timeRange);
             title = `${asset} Price Analysis`;
             summary = `${asset} has shown moderate volatility over the last ${command.timeRange}, with a net positive trend driven by market sentiment.`;
             const prices = data.map(d => d.value);
             const currentPrice = prices[prices.length - 1];
             const maxPrice = Math.max(...prices);
             const minPrice = Math.min(...prices);
             const change = ((currentPrice - prices[0]) / prices[0]) * 100;
             chartType = 'area';
             icon = <TrendingUp size={20} />;
             insights = [
               { icon: '📈', label: 'Highest', value: `$${maxPrice.toLocaleString()}` },
               { icon: '📉', label: 'Lowest', value: `$${minPrice.toLocaleString()}` },
               { icon: '🪙', label: 'Change', value: `${change > 0 ? '+' : ''}${change.toFixed(2)}%` },
               { icon: '📊', label: 'Current', value: `$${currentPrice.toLocaleString()}` }
             ];
             break;
             
           case 'volume':
             data = getVolumeData(asset, command.timeRange);
             title = `${asset} Volume Analysis`;
             summary = `Trading volume for ${asset} has been consistent, with a significant spike observed mid-period indicating increased market interest.`;
             chartType = 'bar';
             icon = <BarChart2 size={20} />;
             insights = [
               { icon: '📊', label: 'Avg Vol', value: '$2.4M' },
               { icon: '💰', label: 'Peak Vol', value: '$5.1M' },
               { icon: '📈', label: 'Trend', value: 'High' },
               { icon: '⚡', label: 'Activity', value: 'Active' }
             ];
             break;
             
           case 'comparison':
             data = getComparisonData(['Nezlobin', 'JIT']);
             title = 'Fee Comparison';
             summary = 'Stable Protection hooks demonstrated superior protection during depeg events compared to standard pools.';
             chartType = 'bar';
             icon = <Activity size={20} />;
             insights = [
               { icon: '💰', label: 'Nezlobin', value: '$142/day' },
               { icon: '⚡', label: 'JIT', value: '$118/day' },
               { icon: '💡', label: 'Insight', value: '+20% Eff' },
               { icon: '🏆', label: 'Winner', value: 'Nezlobin' }
             ];
             break;
             
           case 'portfolio': // Fallback if classify returns 'portfolio' here for some reason, though handled above
             data = getPortfolioData();
             title = 'Portfolio Allocation';
             summary = 'Your portfolio is heavily weighted towards ETH and Stablecoins, maintaining a balanced risk profile.';
             chartType = 'pie';
             icon = <PieIcon size={20} />;
             insights = [
               { icon: '💰', label: 'Total', value: '$3,245' },
               { icon: '📊', label: 'Top Asset', value: 'ETH' },
               { icon: '🛡️', label: 'Stables', value: '30%' },
               { icon: '⚡', label: 'Risk', value: 'Moderate' }
             ];
             break;
             
           case 'performance':
             data = getPerformanceData(command.timeRange);
             title = 'LP Performance';
             summary = 'Your liquidity positions have outperformed holding by 4.2% due to high trading fees captured in the ETH/mUSDC pool.';
             chartType = 'area';
             icon = <Activity size={20} />;
             insights = [
               { icon: '📈', label: 'Net Profit', value: '+$420' },
               { icon: '💰', label: 'Fees', value: '$125' },
               { icon: '⚡', label: 'IL', value: '-$45' },
               { icon: '🔥', label: 'APR', value: '18.5%' }
             ];
             break;

           case 'tvl':
             const pool = 'ETH/mUSDC';
             data = getTVLData(pool);
             title = `${pool} TVL Trends`;
             summary = `Total Value Locked in the ${pool} pool has grown steadily, indicating strong liquidity provider confidence.`;
             chartType = 'area';
             icon = <TrendingUp size={20} />;
             insights = [
               { icon: '💰', label: 'TVL', value: '$5.2M' },
               { icon: '📈', label: 'Growth', value: '+12%' },
               { icon: '👥', label: 'LPs', value: '1,240' },
               { icon: '💧', label: 'Util', value: '85%' }
             ];
             break;
         }

         // Persist via useChat; AI will respond with text about the analysis
         sendMessage(inputValue);
    } else {
      sendMessage(inputValue);
    }
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
              setShowPredictions(false);
              setShowVaults(false);
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
              setShowPredictions(false);
              setShowVaults(false);
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
              setShowPredictions(false);
              setShowVaults(false);
              setShowPortfolioModal(false);
              setShowAddLiquidityModal(false);
              setHasInteracted(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: 8, color: theme.textPrimary, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            <DropletsIcon /> Liquidity
          </button>

          {/* Vaults */}
          <button
            onClick={() => {
              setShowVaults(true);
              setShowPredictions(false);
              setShowSwap(false);
              setShowLiquidity(false);
              setShowAgentBuilder(false);
              setShowPortfolioModal(false);
              setShowAddLiquidityModal(false);
              setHasInteracted(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: showVaults ? `${theme.accent}20` : 'transparent', border: 'none', borderRadius: 8, color: showVaults ? theme.accent : theme.textPrimary, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            <Layers size={16} /> Vaults
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: '#7c3aed', color: 'white', padding: '1px 6px', borderRadius: 10 }}>NEW</span>
          </button>

          {/* Predictions */}
          <button
            onClick={() => {
              setShowPredictions(true);
              setShowSwap(false);
              setShowLiquidity(false);
              setShowAgentBuilder(false);
              setShowVaults(false);
              setShowPortfolioModal(false);
              setShowAddLiquidityModal(false);
              setHasInteracted(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: showPredictions ? `${theme.accent}20` : 'transparent', border: 'none', borderRadius: 8, color: showPredictions ? theme.accent : theme.textPrimary, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            <TrendingUp size={16} /> Predictions
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: '#7c3aed', color: 'white', padding: '1px 6px', borderRadius: 10 }}>NEW</span>
          </button>

          {/* Agent */}
          <button
            onClick={() => {
              setShowAgentBuilder(true);
              setShowPredictions(false);
              setShowVaults(false);
              setShowSwap(false);
              setShowLiquidity(false);
              setShowPortfolioModal(false);
              setShowAddLiquidityModal(false);
              setHasInteracted(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: showAgentBuilder ? `${theme.accent}20` : 'transparent', border: 'none', borderRadius: 8, color: showAgentBuilder ? theme.accent : theme.textPrimary, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            <BotIcon /> Agent
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: 'white', padding: '1px 6px', borderRadius: 10 }}>AI</span>
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

          {/* Faucet */}
          <FaucetButton theme={theme} />

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
                          const sessions = await fetch('/api/chat/sessions').then(res => res.json());
                          setRecentChats(sessions);
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
          
          {/* Predictions — full-page sibling, not inside chat scroll container */}
          {showPredictions && !showSwap && !showLiquidity && !showAgentBuilder && !showAddLiquidityModal && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 110, overflow: 'auto', background: theme.bgPrimary }}>
              <Suspense fallback={<div style={{ padding: 40, color: '#6b7280' }}>Loading…</div>}>
                <PredictionsView theme={theme} isDark={isDark} />
              </Suspense>
            </div>
          )}

          {/* Vaults — full-page sibling, not inside chat scroll container */}
          {showVaults && !showSwap && !showLiquidity && !showAgentBuilder && !showAddLiquidityModal && !showPredictions && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 110, overflow: 'auto', background: theme.bgPrimary }}>
              <Suspense fallback={<div style={{ padding: 40, color: '#6b7280' }}>Loading…</div>}>
                <VaultsView theme={theme} isDark={isDark} />
              </Suspense>
            </div>
          )}

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
                        onClose={() => { setShowAddLiquidityModal(false); setSelectedPool(null); }}
                        theme={theme}
                        isDark={isDark}
                        pool={selectedPool}
                        mode={addLiquidityMode}
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
                          if (view === 'predictions') setShowPredictions(true);
                          if (view === 'vaults') setShowVaults(true);
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <PushToTalkButton
                        onTranscription={handleTranscription}
                        disabled={!isConnected}
                      />
                    </div>
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

    {/* Voice Confirmation Modal — rendered outside the main layout */}
    <VoiceConfirmationModal
      isOpen={voiceModalOpen}
      transcript={voiceTranscript}
      command={voiceParsedCommand}
      onConfirm={handleVoiceConfirm}
      onCancel={handleVoiceCancel}
    />
    </>
  );
}
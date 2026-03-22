/**
 * Wallet Connect Button
 *
 * Displays "Connect Wallet" when disconnected.
 * When connected, shows truncated address and a dropdown with:
 *  - Network badge (Base Sepolia)
 *  - ETH + ERC20 balances with USD values
 *  - Copy address and Disconnect buttons
 */

import { useEffect, useState, useRef, useMemo } from 'react';
import { useAppKit, useAppKitAccount, useDisconnect } from '@reown/appkit/react';
import { useChainId } from 'wagmi';
import { getPriceBySymbol } from '../../services/priceService';
import { getERC20Tokens, CHAIN_IDS } from '../../config/tokens';
import { useWalletBalances } from '../../hooks/useWalletBalances';

interface ConnectButtonProps {
  className?: string;
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

function truncateAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4).toUpperCase()}`;
}

function ExitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const CHAIN_OPTIONS = [
  {
    id: CHAIN_IDS.BASE_SEPOLIA,
    key: 'base-sepolia',
    name: 'Base Sepolia',
    shortName: 'Base',
    color: '#60a5fa',
    bgColor: 'rgba(59,130,246,0.12)',
    icon: '🔵',
  },
];

export function ConnectButton({
  className = '',
  onConnect,
  onDisconnect,
}: ConnectButtonProps) {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentChain = CHAIN_OPTIONS.find(c => c.id === chainId) ?? CHAIN_OPTIONS[0];

  // Callback when connection state changes
  useEffect(() => {
    if (isConnected && address && onConnect) {
      onConnect(address);
    }
  }, [isConnected, address, onConnect]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ERC20 tokens for the current chain
  const erc20Tokens = useMemo(() => getERC20Tokens(chainId), [chainId]);
  const { getBalance } = useWalletBalances(address as `0x${string}` | undefined);

  // Build display rows: ETH + chain-specific ERC20s
  const tokenRows = useMemo(() => [
    {
      symbol: 'ETH',
      balance: parseFloat(getBalance('ETH')?.formatted ?? '0') || 0,
      displayDecimals: 4,
    },
    ...erc20Tokens.map((token, i) => ({
      symbol: token.symbol,
      balance: parseFloat(getBalance(token.symbol)?.formatted ?? '0') || 0,
      displayDecimals: token.symbol === 'cbBTC' ? 6 : 4,
    })),
  ], [erc20Tokens, getBalance]);

  // Format balance for display — handles very large numbers gracefully
  const fmtBalance = (balance: number, decimals: number) => {
    if (balance >= 1e9) return `${(balance / 1e9).toFixed(2)}B`;
    if (balance >= 1e6) return `${(balance / 1e6).toFixed(2)}M`;
    if (balance >= 1e4) return balance.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return balance.toFixed(decimals);
  };

  const totalUsd = tokenRows.reduce((sum, row) => {
    const price = getPriceBySymbol(row.symbol) || (row.symbol === 'USDC' ? 1 : 0);
    return sum + row.balance * price;
  }, 0);

  const handleClick = () => {
    if (isConnected) {
      setDropdownOpen(prev => !prev);
    } else {
      open({ view: 'Connect' });
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setDropdownOpen(false);
    onDisconnect?.();
  };

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  };

  const baseButtonStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #a855f7, #9333ea)',
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    fontFamily: '"DM Sans", sans-serif',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(168, 85, 247, 0.25)',
    transition: 'all 0.2s ease',
    minWidth: 145,
    padding: '10px 16px',
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-testid="connect-button"
        aria-haspopup={isConnected ? 'menu' : undefined}
        aria-label={isConnected ? `Wallet ${address}` : 'Connect wallet'}
        style={{
          ...baseButtonStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          filter: isHovered ? 'brightness(1.1)' : 'brightness(1)',
        }}
      >
        {isConnected ? (
          <span data-testid="wallet-address" style={{ fontWeight: 500 }}>
            {truncateAddress(address!)}
          </span>
        ) : (
          <span>Connect Wallet</span>
        )}
      </button>

      {isConnected && dropdownOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            zIndex: 9999,
            background: '#1a1b23',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: '14px 16px',
            minWidth: 290,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header: truncated address */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 600 }}>
              {truncateAddress(address!)}
            </span>
            <span style={{ color: '#6b7280', fontSize: 11 }}>
              ${totalUsd.toFixed(2)}
            </span>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: 10 }} />

          {/* Token balances */}
          {tokenRows.map(row => {
    const price = getPriceBySymbol(row.symbol) || (row.symbol === 'USDC' ? 1 : 0);
            const usdValue = row.balance * price;
            return (
              <div key={row.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ color: '#9ca3af', fontSize: 13 }}>{row.symbol}</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 500 }}>
                    {fmtBalance(row.balance, row.displayDecimals)}
                  </span>
                  {usdValue > 0.001 && (
                    <span style={{ color: '#6b7280', fontSize: 11, marginLeft: 6 }}>
                      (${usdValue >= 1e6 ? `${(usdValue / 1e6).toFixed(2)}M` : usdValue.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 4, marginBottom: 10 }} />

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCopy}
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 0', color: '#9ca3af', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
            >
              <CopyIcon />
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleDisconnect}
              data-testid="disconnect-button"
              style={{ flex: 1, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '7px 0', color: '#f87171', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
            >
              <ExitIcon />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Alternative: Use AppKit's built-in button component
 */
export function AppKitConnectButton() {
  return <appkit-button />;
}

/**
 * Wallet Connect Button
 *
 * Displays "Connect Wallet" when disconnected.
 * When connected, shows truncated address and a dropdown with:
 *  - Dynamic network badge + inline network switcher (Base Sepolia ↔ Unichain Sepolia)
 *  - ETH + chain-specific ERC20 balances with USD values
 *  - Copy address and Disconnect buttons
 */

import { useEffect, useState, useRef, useMemo } from 'react';
import { useAppKit, useAppKitAccount, useDisconnect } from '@reown/appkit/react';
import { useBalance, useReadContracts, useChainId, useSwitchChain } from 'wagmi';
import { erc20Abi, formatUnits } from 'viem';
import { getPriceBySymbol } from '../../services/priceService';
import { getERC20Tokens, CHAIN_IDS } from '../../config/tokens';

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

// Per-chain display config
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
  {
    id: CHAIN_IDS.UNICHAIN_SEPOLIA,
    key: 'unichain-sepolia',
    name: 'Unichain Sepolia',
    shortName: 'Unichain',
    color: '#f472b6',
    bgColor: 'rgba(244,114,182,0.12)',
    icon: '🦄',
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
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [networkMenuOpen, setNetworkMenuOpen] = useState(false);
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
        setNetworkMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Native ETH balance — scoped to current chain
  const { data: ethBalance } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId,
    query: { enabled: isConnected && !!address, refetchInterval: 30_000 },
  });

  // ERC20 tokens for the current chain
  const erc20Tokens = useMemo(() => getERC20Tokens(chainId), [chainId]);

  // ERC20 balances via multicall — explicitly scoped to current chain
  const erc20Contracts = useMemo(() => {
    if (!address) return [];
    return erc20Tokens.map(token => ({
      address: token.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [address as `0x${string}`],
      chainId,
    }));
  }, [address, erc20Tokens, chainId]);

  const { data: erc20Data } = useReadContracts({
    contracts: erc20Contracts,
    query: { enabled: isConnected && !!address, refetchInterval: 30_000 },
  });

  // Build display rows: ETH + chain-specific ERC20s
  const tokenRows = useMemo(() => [
    {
      symbol: 'ETH',
      balance: ethBalance ? parseFloat(formatUnits(ethBalance.value, 18)) : 0,
      decimals: 4,
    },
    ...erc20Tokens.map((token, i) => ({
      symbol: token.symbol,
      balance: erc20Data?.[i]?.result
        ? parseFloat(formatUnits(erc20Data[i].result as bigint, token.decimals))
        : 0,
      decimals: token.decimals <= 8 ? 6 : 4,
    })),
  ], [ethBalance, erc20Data, erc20Tokens]);

  const totalUsd = tokenRows.reduce((sum, row) => {
    const price = getPriceBySymbol(row.symbol) || (row.symbol === 'USDC' || row.symbol === 'EURC' ? 1 : 0);
    return sum + row.balance * price;
  }, 0);

  const handleClick = () => {
    if (isConnected) {
      setDropdownOpen(prev => !prev);
      if (dropdownOpen) setNetworkMenuOpen(false);
    } else {
      open({ view: 'Connect' });
    }
  };

  const handleSwitchChain = async (targetChainId: number) => {
    if (targetChainId === chainId) {
      setNetworkMenuOpen(false);
      return;
    }
    try {
      await switchChain({ chainId: targetChainId });
    } catch (e) {
      console.error('Chain switch failed:', e);
    }
    setNetworkMenuOpen(false);
  };

  const handleDisconnect = async () => {
    await disconnect();
    setDropdownOpen(false);
    setNetworkMenuOpen(false);
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

          {/* ── Network Switcher ─────────────────────────────── */}
          <div style={{ marginBottom: 12, position: 'relative' }}>
            <button
              onClick={() => setNetworkMenuOpen(prev => !prev)}
              disabled={isSwitching}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: currentChain.bgColor,
                border: `1px solid ${currentChain.color}30`,
                borderRadius: 10,
                cursor: isSwitching ? 'wait' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {/* Live indicator dot */}
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: currentChain.color,
                boxShadow: `0 0 6px ${currentChain.color}80`,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: currentChain.color, textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1, textAlign: 'left' }}>
                {isSwitching ? 'Switching…' : currentChain.name}
              </span>
              <span style={{ color: '#6b7280' }}>
                <ChevronIcon open={networkMenuOpen} />
              </span>
            </button>

            {networkMenuOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                background: '#12131a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                overflow: 'hidden',
                zIndex: 10000,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}>
                {CHAIN_OPTIONS.map(chain => {
                  const isActive = chain.id === chainId;
                  return (
                    <button
                      key={chain.id}
                      onClick={() => handleSwitchChain(chain.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        background: isActive ? `${chain.color}10` : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: `${chain.color}18`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, flexShrink: 0,
                      }}>
                        {chain.icon}
                      </div>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ color: isActive ? chain.color : '#e5e7eb', fontSize: 13, fontWeight: 600 }}>
                          {chain.name}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: 11 }}>{chain.name}</div>
                      </div>
                      {isActive && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={chain.color} strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: 10 }} />

          {/* Token balances */}
          {tokenRows.map(row => {
            const price = getPriceBySymbol(row.symbol) || (row.symbol === 'USDC' || row.symbol === 'EURC' ? 1 : 0);
            const usdValue = row.balance * price;
            return (
              <div key={row.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ color: '#9ca3af', fontSize: 13 }}>{row.symbol}</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 500 }}>
                    {row.balance.toFixed(row.decimals)}
                  </span>
                  {usdValue > 0.001 && (
                    <span style={{ color: '#6b7280', fontSize: 11, marginLeft: 6 }}>
                      (${usdValue.toFixed(2)})
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

/**
 * Reown AppKit Configuration
 *
 * Initializes the AppKit instance with multi-chain support
 * and WALLET-ONLY authentication (no email/social login).
 *
 * Default network: Base Sepolia (chainId: 84532)
 *
 * IMPORTANT: Call this OUTSIDE React components to prevent re-renders.
 */

import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { baseSepolia } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { defineChain } from 'viem';

// Get project ID - REQUIRED for WalletConnect QR code
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || 'ad3378514000476f8321eef10f16882e';
const isDevMode = !import.meta.env.VITE_REOWN_PROJECT_ID;

if (isDevMode) {
  console.warn(
    '[AppKit] Using fallback project ID. For production, set VITE_REOWN_PROJECT_ID in .env'
  );
}

// Application metadata for wallet display (REQUIRED for WalletConnect QR pairing)
const metadata = {
  name: 'Mantua.AI',
  description: 'AI-powered DeFi trading platform with Uniswap v4 hooks',
  // Must match actual domain for WalletConnect verification
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000',
  icons: ['https://mantua.ai/favicon.png'],
};

// Unichain Sepolia custom chain definition
const unichainSepolia = defineChain({
  id: 1301,
  name: 'Unichain Sepolia',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://sepolia.unichain.org'] },
  },
  blockExplorers: {
    default: { name: 'Uniscan', url: 'https://sepolia.uniscan.xyz' },
  },
  testnet: true,
});

// Supported networks - Base Sepolia and Unichain Sepolia
const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  baseSepolia,
  unichainSepolia as AppKitNetwork,
];

// Initialize Wagmi adapter
const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
});

// Create and export the AppKit modal instance
export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,

  // DEFAULT NETWORK CONFIGURATION
  // Defaults to Base Sepolia but allows switching to Unichain Sepolia
  defaultNetwork: baseSepolia,
  allowUnsupportedChain: false,           // Only allow configured testnets

  // Theme configuration - follows system preference by default
  // DO NOT hardcode 'dark' or 'light' - let it be dynamic
  // themeMode will be controlled programmatically via useAppKit().setThemeMode()
  themeMode: undefined, // undefined = follows system preference automatically

  themeVariables: {
    // These variables work for both light and dark modes
    '--w3m-color-mix': '#00BB7F',        // Accent color (teal/green)
    '--w3m-color-mix-strength': 20,
    '--w3m-accent': '#3B82F6',            // Blue accent for buttons
    '--w3m-border-radius-master': '8px',
  },

  // WALLET-ONLY CONFIGURATION
  // Email and social login are DISABLED
  features: {
    analytics: true,
    email: false,                         // DISABLED - wallet only
    socials: false,                       // DISABLED - wallet only
    swaps: false,                         // Disable for MVP
    onramp: false,                        // Disable for MVP
  },

  // Wallet display options - CRITICAL for search functionality
  allWallets: 'SHOW',                     // REQUIRED: Show "All Wallets" with search (540+)

  // Featured wallets appear at top, but search still works across all wallets
  featuredWalletIds: [
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369', // Rainbow
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust
    'a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393', // Phantom
  ],

  // DO NOT use includeWalletIds or excludeWalletIds - they break search
  // includeWalletIds: undefined,
  // excludeWalletIds: undefined,
});

// Export wagmi config for WagmiProvider
export const wagmiConfig = wagmiAdapter.wagmiConfig;

// Export networks for use in components
export { networks };

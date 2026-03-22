/**
 * Reown AppKit Configuration
 *
 * Initializes the AppKit instance with Base Sepolia support
 * and WALLET-ONLY authentication (no email/social login).
 *
 * Supported networks: Base Sepolia
 *
 * IMPORTANT: Call this OUTSIDE React components to prevent re-renders.
 */

import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { baseSepolia } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { http } from 'viem';

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || 'ad3378514000476f8321eef10f16882e';
const isDevMode = !import.meta.env.VITE_REOWN_PROJECT_ID;

if (isDevMode) {
  console.warn(
    '[AppKit] Using fallback project ID. For production, set VITE_REOWN_PROJECT_ID in .env'
  );
}

const metadata = {
  name: 'Mantua.AI',
  description: 'AI-powered DeFi trading platform with Uniswap v4 hooks',
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000',
  icons: ['https://mantua.ai/favicon.png'],
};

const networks: [AppKitNetwork, ...AppKitNetwork[]] = [baseSepolia];

const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
});

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,

  defaultNetwork: baseSepolia,
  allowUnsupportedChain: false,

  themeMode: undefined,

  themeVariables: {
    '--w3m-color-mix': '#00BB7F',
    '--w3m-color-mix-strength': 20,
    '--w3m-accent': '#3B82F6',
    '--w3m-border-radius-master': '8px',
  },

  features: {
    analytics: true,
    email: false,
    socials: false,
    swaps: false,
    onramp: false,
  },

  allWallets: 'SHOW',

  featuredWalletIds: [
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
    '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
    'a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393',
  ],
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

export { networks, baseSepolia };

# Mock Tokens Deployment Guide

## Prerequisites

1. Foundry installed and forge available in PATH
2. Private key with Base Sepolia ETH for deployment
3. BaseScan API key for contract verification

## Step 1: Set Environment Variables

Create a `.env` file in the root directory:

```bash
PRIVATE_KEY=your_private_key_without_0x_prefix
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=your_basescan_api_key
```

## Step 2: Build and Test Contracts

```bash
# Add forge to PATH (if not already done)
export PATH="$HOME/.foundry/bin:$PATH"

# Build contracts
forge build

# Run tests
forge test -vvv
```

All 18 tests should pass.

## Step 3: Deploy Mock Token Factory

```bash
forge script contracts/script/DeployMockTokens.s.sol:DeployMockTokens \
  --rpc-url base_sepolia \
  --broadcast \
  --verify
```

This will:
- Deploy the MockTokenFactory contract
- Deploy the supported mock tokens (mUSDC, mEURC, mcbBTC, mETH)
- Verify contracts on BaseScan
- Output all token addresses

## Step 4: Update Frontend Configuration

Copy the deployed addresses from the console output and update [client/src/config/tokens.ts](client/src/config/tokens.ts):

```typescript
export const MOCK_TOKEN_ADDRESSES = {
  mUSDC: "0x...",  // Copy from deployment output
  mEURC: "0x...",
  mcbBTC: "0x...",
  mETH: "0x...",
};

export const MOCK_TOKEN_FACTORY = "0x..."; // Factory address
```

## Step 5: (Optional) Seed Initial Liquidity

Set the factory address in your `.env`:

```bash
MOCK_TOKEN_FACTORY=0x...  # Address from deployment
```

Then run the seed script:

```bash
forge script contracts/script/DeployMockTokens.s.sol:SeedLiquidity \
  --rpc-url base_sepolia \
  --broadcast
```

This will mint initial liquidity:
- 1M mUSDC
- 1M mEURC
- 10K mcbBTC
- 1K mETH

## Deployed Contracts

### MockERC20.sol
Base token contract with:
- Custom decimals support
- Public faucet with 1-hour cooldown
- Owner mint function for liquidity seeding
- `faucetFor(address)` function for factory integration

### MockTokenFactory.sol
Factory contract that:
- Deploys all 7 mock tokens
- Provides `claimAllFaucets()` batch function
- Provides `checkAllFaucets(address)` status function
- Provides `mintLiquidity()` for seeding

## Frontend Components

### Faucet Component
Located at [client/src/components/Faucet.tsx](client/src/components/Faucet.tsx)
- Displays all tokens with claim status
- Shows countdown timers for cooldowns
- "Claim All" button for batch claiming
- Individual claim buttons per token

### TokenBalances Component
Located at [client/src/components/TokenBalances.tsx](client/src/components/TokenBalances.tsx)
- Shows native ETH balance
- Shows all mock token balances
- Uses real token icons from CoinGecko CDN

### TokenSelector Component
Located at [client/src/components/TokenSelector.tsx](client/src/components/TokenSelector.tsx)
- Dropdown for selecting tokens
- Search functionality
- Filters out excluded tokens (for swap pairs)
- Shows "Mock" badge for testnet tokens

## Testing the Faucet

After deployment:

1. Connect your wallet to Base Sepolia
2. Navigate to the Faucet component
3. Click "Claim All" or individual "Claim" buttons
4. Wait 1 hour between claims (per token)
5. Check TokenBalances to see your balances

## Contract Verification

Contracts are automatically verified during deployment with the `--verify` flag. You can verify them manually:

```bash
forge verify-contract \
  --chain base-sepolia \
  --compiler-version v0.8.26 \
  <CONTRACT_ADDRESS> \
  contracts/src/tokens/MockTokenFactory.sol:MockTokenFactory
```

## Token Specifications

| Token | Symbol | Decimals | Faucet Amount | Icon |
|-------|--------|----------|---------------|------|
| Mantua USDC | mUSDC | 6 | 10,000 | USDC |
| Mantua EURC | mEURC | 6 | 10,000 | EURC |
| Mantua cbBTC | mcbBTC | 8 | 1 | cbBTC |
| Mantua ETH | mETH | 18 | 10 | ETH |

## Troubleshooting

### Forge command not found
```bash
# Add foundry to PATH
export PATH="$HOME/.foundry/bin:$PATH"
```

### Tests failing
```bash
# Rebuild from scratch
forge clean
forge build
forge test -vvv
```

### Deployment fails
- Check that you have enough Base Sepolia ETH
- Verify your private key is correct (without 0x prefix)
- Ensure RPC URL is accessible

## Next Steps

1. Deploy contracts to Base Sepolia
2. Update frontend token addresses
3. Test faucet functionality
4. Integrate TokenSelector into swap UI
5. Set up liquidity pools (if needed)

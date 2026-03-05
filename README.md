# Mantua.AI

> An AI-Powered DeFi Trading Platform with Conversational Agents and Custom Uniswap V4 Hooks

---

## Overview

### Our Vision

Mantua.AI is building the foundation for the next generation of human-DeFi interaction — where traders, liquidity providers, and developers interact with on-chain protocols through natural language rather than complex interfaces.

Think autonomous LP agents, text-driven swaps, custom hook-powered stablecoin pools, and AI-guided portfolio management — all coexisting in a single, composable platform.

### Our Platform

This repository presents Mantua.AI's flagship product: a conversational DeFi interface built on Uniswap V4 with an autonomous agent layer and custom hook infrastructure.

We have implemented a system that:

- Accepts **text commands** to execute swaps, manage liquidity, and monitor positions
- Deploys a **Stable Protection Hook** — a custom Uniswap V4 hook engineered for stablecoin pair stability
- Operates an **autonomous LP agent** capable of executing liquidity operations on any Uniswap V4 pool without a custom hook
- Provides a **unified portfolio dashboard** with real-time position tracking across supported testnets

---

## Architecture

The system follows a modular architecture with clear separation of concerns:

### Core Components

**Conversational Interface**
- Text-based chat with persistent session history
- Natural language parsing mapped to on-chain transaction execution

**Autonomous LP Agent (`AgentKit`)**
- Coinbase AgentKit integration for autonomous liquidity operations
- Works with any Uniswap V4 pool — no custom hook required
- Executes position rebalancing, range adjustments, and liquidity additions/removals

**Stable Protection Hook (`StableProtectionHook.sol`)**
- Implements Uniswap V4 `IHooks` interface
- StableSwap invariant curve math for stablecoin pairs
- 5-zone peg deviation monitoring with real-time state transitions
- Dynamic amplification factor (`A`) adjusted based on market conditions
- Circuit breaker triggering at >5% peg deviation

**Frontend Application**
- React / TypeScript with wagmi and Reown AppKit (WalletConnect)
- Swap, liquidity, portfolio, and agent interfaces
- Chain selector supporting Base Sepolia and Unichain Sepolia

**Sepolia Networks**
- Deployed on Unichain Sepolia
- Deployed on Base Sepolia

### Hook Parameters

The Stable Protection Hook is governed by the following parameters:

| Parameter | Description |
|---|---|
| `amplificationFactor` | StableSwap A parameter — controls curve shape |
| `pegTarget` | Target price peg (1e18 scaled) |
| `deviationZones` | 5-zone band definitions around the peg |
| `feeTowardPeg` | Fee multiplier for swaps moving price toward peg (0.5×) |
| `feeAwayFromPeg` | Fee multiplier for swaps moving price away from peg (3.0×) |
| `circuitBreakerThreshold` | Deviation % that halts swaps (5%) |

---

## Security

### Security Patterns

- **OpenZeppelin 5 Contracts**: `Ownable2Step`, `ReentrancyGuardTransient`, `Pausable`
- **Access Control**: Hook owner with two-step ownership transfers; role-based permissions for sensitive operations
- **State Protection**: Reentrancy guards on all liquidity and swap entry points; pausable for emergency stops

### Economic Security

- **Circuit Breaker**: Automatic swap suspension at >5% peg deviation
- **Directional Fee Throttling**: Asymmetric fees discourage destabilizing trades
- **Dynamic Amplification**: A-factor tightens the curve during calm markets and loosens during volatility to reduce slippage risk
- **Zone-Based Monitoring**: 5-zone peg tracking enables graduated response before circuit breaker activation

---

## Testing

The protocol includes comprehensive testing across multiple layers:

- **Unit Tests**: Isolated validation of StableSwap math, fee logic, and zone transitions
- **Integration Tests**: Hook lifecycle scenarios against live Uniswap V4 PoolManager
- **Fuzz Tests**: Randomized swap inputs validating invariant preservation
- **Simulation Tests**: Multi-swap sequences testing peg recovery and circuit breaker behavior

All tests are built with **Foundry**. Current status: **81 tests passing**.

---

## Development

### Prerequisites

- [Foundry](https://getfoundry.sh/)
- Node.js >= 18
- Git with submodules support
- PostgreSQL instance

### Setup

```bash
# Clone repository with submodules
git clone --recurse-submodules https://github.com/DelleonMcglone/mantua.git
cd mantua

# Install frontend dependencies
npm install

# Install Foundry dependencies
forge install

# Build contracts
forge build
```

### Running Tests

```bash
# Run all contract tests
forge test

# Run with gas reporting
forge test --gas-report

# Run Stable Protection Hook tests only
forge test --match-path "test/StableProtectionHook.t.sol"

# Run with verbosity
forge test -vvv
```

### Running the Frontend

```bash
cp .env.example .env
# Fill in required environment variables

npm run dev
```

---

## Deployment

Deployment scripts are located in `script/`.

```bash
# 1. Set up environment
cp .env.example .env
source .env

# 2. Deploy Stable Protection Hook
forge script script/00_DeployStableProtectionHook.s.sol \
  --rpc-url $UNICHAIN_SEPOLIA_RPC --broadcast --verify

# 3. Create pool with hook
forge script script/01_CreatePool.s.sol \
  --rpc-url $UNICHAIN_SEPOLIA_RPC --broadcast

# 4. Add initial liquidity
forge script script/02_AddLiquidity.s.sol \
  --rpc-url $UNICHAIN_SEPOLIA_RPC --broadcast

# 5. Test swap execution
forge script script/03_Swap.s.sol \
  --rpc-url $UNICHAIN_SEPOLIA_RPC --broadcast
```

### Testnet Contract Addresses

> Testnet only. Do not send real funds.

| Contract | Network | Address |
|---|---|---|
| Unichain PoolManager | Unichain Sepolia | `0x00b036b58a818b1bc34d502d3fe730db729e62ac` |
| PoolSwapTest | Unichain Sepolia | `0x9140a78c1a137c7ff1c151ec8231272af78a99a4` |
| PoolModifyLiquidityTest | Unichain Sepolia | `0x5fa728c0a5cfd51bee4b060773f50554c0c8a7ab` |
| Mock Token Faucet | Base Sepolia | `0xaa0D98c815C3003d35E571fD51C65d7F92391883` |

---

## Supported Networks

| Network | Chain ID | Explorer |
|---|---|---|
| Base Sepolia | 84532 | [BaseScan](https://sepolia.basescan.org) |
| Unichain Sepolia | 1301 | [Uniscan](https://sepolia.uniscan.xyz) |

---

## Links & Resources

- **Stable Protection Hook Repo**: [github.com/DelleonMcglone/stableprotection-hook](https://github.com/DelleonMcglone/stableprotection-hook)
- Website: Coming soon
- Documentation: Coming soon

---

## Acknowledgements

Mantua.AI builds on top of **Uniswap V4**, leveraging its hook system for custom pool logic. Our implementation follows the official [Uniswap V4 template](https://github.com/uniswapfoundation/v4-template) and incorporates **OpenZeppelin** security primitives throughout. Hook development was guided by the Atrium Academy Uniswap Hooks Intensive program.

Autonomous agent functionality is powered by **Coinbase AgentKit**. Voice transcription is powered by **OpenAI Whisper**.

---

## License

This project is licensed under the **MIT License**. See `LICENSE` for full terms.

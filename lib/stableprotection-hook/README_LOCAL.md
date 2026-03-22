# Stable Protection Hook — Local Library

Source: https://github.com/DelleonMcglone/stableprotection-hook

This folder contains the Solidity source files for the StableProtectionHook
Uniswap v4 hook, included here as a reference library for the Mantua.AI platform.

## Files

| File | Description |
|------|-------------|
| `src/StableProtectionHook.sol` | Main hook contract (beforeSwap, afterSwap, beforeInitialize) |
| `src/interfaces/IStableProtectionHook.sol` | External interface — getPoolConfig, getZoneState |
| `src/libraries/PegMonitor.sol` | Peg deviation classifier and fee calculator |
| `src/libraries/SPConfig.sol` | Pool configuration validation |
| `src/libraries/StableSwapMath.sol` | Stablecoin AMM math (amplification factor A) |
| `src/types/SPTypes.sol` | Shared structs and enums (PegZone, PoolConfig, ZoneState) |
| `script/Deploy.s.sol` | Foundry deployment script |

## Integration in Mantua.AI

The hook address on Base Sepolia is `0xB5faDA071CD56b3F56632F6771356C3e3834a0C0`.

Validation logic lives in `client/src/lib/hook-validator.ts`:
- When a swap or pool creation uses the Stable Protection hook, `validateHookConnection()` is called.
- It checks bytecode is present at the hook address via `eth_getCode`.
- It optionally reads `getZoneState` to confirm the ABI is live.
- The result is shown to the user as a toast (swap) or step label (add liquidity).

## Peg Zones (from PegMonitor.sol)

| Zone | Threshold | Base Fee | Dynamic A | Behaviour |
|------|-----------|----------|-----------|-----------|
| HEALTHY | ≤ 10 bps | 1 bps | 100% of A | Normal trading |
| MINOR | ≤ 50 bps | 5 bps | 80% of A | Mild stress |
| MODERATE | ≤ 200 bps | 15 bps | 50% of A | Elevated risk |
| SEVERE | ≤ 500 bps | 50 bps | 25% of A | High risk |
| CRITICAL | > 500 bps | — | 10% of A | Swaps blocked |

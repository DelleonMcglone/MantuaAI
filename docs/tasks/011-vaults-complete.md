# Task 011 — Vaults Complete

## Objective
Build a fully integrated Vaults section in Mantua.AI. Users deposit LP tokens from their Mantua
liquidity positions into ERC-4626 compliant vaults that simulate yield. Four pre-deployed vaults
with distinct risk profiles and APYs.

---

## Tasks

### P1-059 — MantuaVault.sol (ERC-4626)
- ERC-4626 vault accepting LP token deposits
- Simulates yield accrual (APY stored in basis points)
- Emergency pause via Ownable
- Solidity 0.8.26, OpenZeppelin v5, Foundry

### P1-060 — Foundry project + tests
- `contracts/vaults/foundry.toml`
- `contracts/vaults/test/MantuaVault.t.sol` — 9 tests covering deposit, withdraw, yield, pause
- `contracts/vaults/script/DeployBaseSepolia.s.sol`
- `contracts/vaults/script/DeployUnichainSepolia.s.sol`

### P1-061 — ABI + contracts config
- `client/src/abis/MantuaVault.json`
- Add `VAULTS` to `client/src/config/contracts.ts`

### P1-062 — Database schema
- Add `vaults`, `vault_positions`, `vault_performance` tables to `shared/schema.ts`

### P1-063 — Vault config
- `client/src/config/vaults.ts` — 4 VAULT_CONFIGS with metadata, APY, strategy, risk

### P1-064 — useVaults hook
- `client/src/hooks/useVaults.ts` — batch reads for all 4 vaults (totalAssets, totalSupply, pricePerShare, userShares)

### P1-065 — useVaultActions hook
- `client/src/hooks/useVaultActions.ts` — useVaultDeposit + useVaultWithdraw
- Handles ERC-20 approval flow before deposit

### P1-066 — VaultsView
- `client/src/components/vaults/VaultsView.tsx`
- Stats row: Total TVL / Avg APY / My Deposits
- Tabs: Vaults | My Deposits | Performance

### P1-067 — VaultsGrid + VaultCard
- `client/src/components/vaults/VaultsGrid.tsx` — strategy filter, 2-column grid
- `client/src/components/vaults/VaultCard.tsx` — APY dominant visual, strategy badge, risk level

### P1-068 — VaultDetailModal
- `client/src/components/vaults/VaultDetailModal.tsx`
- createPortal, 3-metric header, Deposit/Withdraw tabs

### P1-069 — DepositForm + WithdrawForm
- `client/src/components/vaults/DepositForm.tsx`
- `client/src/components/vaults/WithdrawForm.tsx`

### P1-070 — MyDepositsTab + PerformanceTab + nav integration
- `client/src/components/vaults/MyDepositsTab.tsx`
- `client/src/components/vaults/PerformanceTab.tsx`
- Sidebar "Vaults" nav item (Layers icon) in `client/src/pages/app.tsx`
- Voice command support

---

## Four Vaults

| Name                         | Strategy  | APY   | Risk   |
|------------------------------|-----------|-------|--------|
| ETH/mUSDC LP Vault           | lp        | 12.4% | medium |
| mUSDC/mUSDT Stable Vault     | stable    | 8.1%  | low    |
| ETH/mBTC LP Vault            | lp        | 18.7% | high   |
| AI-Managed Multi-Strategy    | multi     | 24.2% | high   |

---

## Success Criteria
- [ ] All 4 vaults display with correct APY + TVL in the Vaults grid
- [ ] Deposit flow: approve LP token → deposit → shares minted, confirmed on-chain
- [ ] Withdraw flow: redeem shares → LP tokens returned
- [ ] My Deposits tab shows user's share balance and USD value
- [ ] Performance tab shows historical APY chart (mock data)
- [ ] Vaults sidebar button opens VaultsView full-page overlay
- [ ] Voice commands: "show vaults", "deposit 100 into ETH vault"
- [ ] Build passes zero errors

## Failure Conditions
- VaultsView rendered inside the chat scroll container (must be sibling overlay like PredictionsView)
- ERC-4626 interface methods not correctly called (use assets/shares, not amounts directly)
- Approval skipped before deposit

## Edge Cases
- Wallet disconnected: show connect prompt in VaultDetailModal
- Insufficient balance: disable deposit button
- Paused vault: show paused state, disable deposit/withdraw

# Task 009: Add Liquidity Modal — Fix & Complete Implementation

## Description
Fix four UI/UX bugs in the Add Liquidity modal and complete the full
add-liquidity feature including dual token input, contract integration,
and transaction flow.

## Success Criteria
- [ ] Modal is perfectly centered on all screen sizes (matches Swap modal centering)
- [ ] Token selectors in the Add Liquidity form open the TokenSelector component
- [ ] "Create Pool" path allows user to choose both tokens freely
- [ ] Amount inputs are editable; entering token A auto-calculates token B (at current price ratio)
- [ ] USD value displays below each amount input
- [ ] Range buttons (Full Range / Wide / Narrow / Custom) are interactive and update state
- [ ] "Add Liquidity with {Hook Name}" CTA button:
  - Is disabled when amounts are 0 or wallet not connected
  - Triggers approval flow if token allowance insufficient
  - Calls PoolModifyLiquidityTest.modifyLiquidity() with correct params
  - Shows pending/confirming/success/error states
- [ ] Transaction success shows explorer link
- [ ] All interactions work in both dark and light mode
- [ ] No TypeScript errors; all new files ≤ 150 lines

## Failure Conditions
- Token selector does not open on click
- CTA button submits with 0 amounts
- Modal renders off-center on any viewport
- Contract call uses wrong pool key or tick range
- Unhandled promise rejections in console

## Edge Cases
- Wallet not connected: show "Connect Wallet" button instead of CTA
- Insufficient token balance: disable CTA, show "Insufficient {token} balance"
- Pool does not exist yet (Create Pool path): must initialize pool first
- User enters amount exceeding balance
- Network mismatch between UI and wallet

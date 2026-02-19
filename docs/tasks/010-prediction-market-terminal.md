# Task 010: Prediction Market Terminal

## Description
Integrate a full prediction market terminal into Mantua.AI covering:
smart contract development and deployment, aggregator UI across Polymarket
and Kalshi, AI chat integration, voice commands, and position tracking.

## Task IDs
P1-047, P1-048, P1-049, P1-050, P1-051, P1-052, P1-053,
P1-054, P1-055, P1-056, P1-057, P1-058

## Success Criteria
- [ ] MantuaPredictionMarket.sol compiles with zero warnings
- [ ] Contract deployed and verified on Base Sepolia
- [ ] Contract deployed and verified on Unichain Sepolia
- [ ] Predictions sidebar item renders full-page view
- [ ] Markets tab shows unified grid (our markets + Polymarket + Kalshi)
- [ ] Category and venue filters work
- [ ] Market detail modal opens with orderbook-style YES/NO display
- [ ] User can place a bet on our contract markets using mock USDC
- [ ] Admin can resolve a market (YES or NO outcome)
- [ ] Winning users can claim their USDC payout
- [ ] My Positions tab shows open positions with unrealized P&L
- [ ] Arbitrage tab surfaces cross-venue spread opportunities
- [ ] Chat commands work: odds query, arb scan, bet placement
- [ ] Voice commands work: "show predictions", "bet 50 USDC on YES"
- [ ] All UI works in light and dark mode
- [ ] No TypeScript errors; all files ≤ 150 lines

## Failure Conditions
- Contract deployed to wrong address or reverts on basic calls
- Token selector does not filter to USDC for betting
- Bet submission sends 0 amount or calls wrong function
- Resolution callable by non-admin address
- Arb opportunities show 0% spread on all markets
- Chat fails to parse prediction market intents
- UI breaks on mobile viewport

## Edge Cases
- User has 0 mock USDC balance: show "Get USDC from Faucet" link
- Market already resolved: disable betting, show outcome banner
- Market end time passed but not yet resolved: show "Awaiting Resolution"
- User tries to claim on a market they didn't win
- Polymarket API rate limited or unavailable: graceful fallback to cached data
- Network mismatch: prompt user to switch to correct chain

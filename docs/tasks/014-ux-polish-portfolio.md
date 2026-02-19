# Task 014 — UX Polish & Portfolio Features (7 tasks)

## Success Criteria
- [ ] Skeleton loaders appear on all async data components during loading
- [ ] Skeleton dimensions match the real content they replace exactly
- [ ] Error states display user-readable messages, never raw Error objects
- [ ] Every error state has a retry action (button or link)
- [ ] Transaction history panel shows last 20 txs with status badges
- [ ] Tx history panel accessible from navbar or portfolio view
- [ ] Remove liquidity flow mirrors add liquidity UX exactly
- [ ] Remove liquidity shows current position before confirming
- [ ] LP position value shown in USD next to each position
- [ ] USD value derived from Pyth price + position liquidity math
- [ ] "Show my positions" chat command navigates to portfolio + displays positions
- [ ] "What's my balance?" voice command returns ETH + top token balances
- [ ] Voice command response plays back as chat message
- [ ] No TypeScript errors
- [ ] No files over 150 lines

## Failure Conditions
- Skeleton flashes briefly then shows content (timing too short)
- Raw error message like "TypeError: Cannot read properties of undefined" shown to user
- Remove liquidity flow creates a separate page instead of reusing liquidity view
- LP position value shown as 0 instead of being calculated
- Voice command "What's my balance?" triggers swap flow instead of balance
- Any existing functionality broken by these changes

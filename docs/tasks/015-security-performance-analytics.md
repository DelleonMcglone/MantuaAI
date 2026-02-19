# Task 015 — Security, Performance & Analytics (8 tasks)

## Success Criteria

### Security & Performance
- [ ] Rate limiting applied to all POST endpoints: 100 req/15min general, 10 req/min agent
- [ ] Rate limiting returns 429 with Retry-After header, never crashes
- [ ] Wallet signature verified server-side before any wallet-scoped write operation
- [ ] Unverified requests to wallet-scoped endpoints return 401
- [ ] All chat input sanitized before storage or LLM submission (HTML stripped, length capped)
- [ ] All server-side inputs validated with Zod schemas on every route
- [ ] Bundle size reduced ≥ 20% via code splitting and lazy loading
- [ ] No single JS chunk > 500KB after optimization

### Analytics
- [ ] Connected wallet count tracked on every wallet connection event
- [ ] Voice command usage % tracked (voice commands / total commands)
- [ ] Hook adoption % tracked (txs with hook / total swap txs)
- [ ] Analytics dashboard accessible via sidebar nav item
- [ ] Dashboard shows: connected wallets, voice %, hook %, daily active wallets, events over time
- [ ] All analytics stored in PostgreSQL events table
- [ ] No PII stored — wallet addresses hashed before storage

## Failure Conditions
- Rate limiter crashes the server instead of returning 429
- Wallet signature required for read-only public endpoints (over-engineering)
- Raw wallet address stored in analytics table
- Bundle size increases after optimization
- Analytics dashboard visible to all users without any protection

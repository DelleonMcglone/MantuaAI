# Mantua.AI — Agent Guide (DelleonMcglone/MantuaAI)

AI-powered DeFi trading platform: a conversational interface over Uniswap V4 on Base Sepolia
testnet (chain 84532), with an autonomous Coinbase AgentKit LP agent and a custom Stable
Protection Hook for stablecoin pools. One Express process serves both the API and the
Vite client middleware on a single port.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js >= 18 (verified v20.20.2); npm 10.8.2, bun 1.3.14 |
| Language | TypeScript, ES modules (`"type": "module"`) |
| Frontend | React 19 + Vite 7 + Tailwind CSS v4 + shadcn/ui (Radix) + wagmi/viem + Reown AppKit + wouter + React Query + Recharts |
| Backend | Express 5; dev via tsx, prod bundle `dist/index.cjs` (esbuild) |
| Database | PostgreSQL + Drizzle ORM (node-postgres); ORM source of truth: `shared/schema.ts` |
| Contracts | Foundry / Solidity — Uniswap V4 hook workspace at repo root + `contracts/` (forge NOT installed in this sandbox) |
| Indexing | The Graph subgraphs (`subgraph/base-sepolia`, `subgraph/unichain-sepolia`) |

Package manager: npm scripts in `package.json`. Lockfiles: `pnpm-lock.yaml` (tracked),
`bun.lock` (untracked). `node_modules` is pre-baked in the sandbox image.

## Commands

```bash
npm run dev        # dev server (API + Vite middleware) on PORT (default 5000) — requires .env
npm run dev:client # vite dev --port 5000 (standalone client; the server normally embeds Vite)
npm run build      # esbuild server bundle + client build -> dist/
npm start          # production: NODE_ENV=production node dist/index.cjs
npm test           # vitest run (server/tests + client/src/tests)
npm run check      # tsc — currently a NO-OP: no tsconfig.json is committed (prints help)
npm run db:push    # drizzle-kit push — needs a drizzle config; none committed (see Known issues)
```

On boot the dev server auto-applies the SQL migrations inlined in `server/db/migrate.ts`
(idempotent; failures are caught and logged, boot continues).

## Codebase map

See [codebase-map.md](codebase-map.md).

## Local verification

1. Postgres up and `DATABASE_URL` set (see [skills/local-dev/SKILL.md](skills/local-dev/SKILL.md) for full setup).
2. `npm run dev` -> log line `serving on port 5000`.
3. `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/` -> `200` (landing page).
4. Chat flow (persists to Postgres):
   - `curl -X POST http://127.0.0.1:5000/api/chat/sessions -H 'Content-Type: application/json' -d '{"title":"smoke","userId":"u1"}'` -> 200, JSON `session.id`
   - `curl -X POST http://127.0.0.1:5000/api/chat/messages -H 'Content-Type: application/json' -d '{"sessionId":"<id>","role":"user","content":"swap 1 eth for usdc"}'` -> 200
   - `curl http://127.0.0.1:5000/api/chat/messages/<id>` -> 200, 1 message
5. `curl http://127.0.0.1:5000/api/prices` -> 200 with live CoinGecko prices (works without an API key).

### Local Verification Summary (2026-09-03 onboarding run)

- Postgres 17 provisioned via apt; role/db `mantua`; 11 Drizzle tables (from `shared/schema.ts`)
  plus legacy `pools` / `portfolio_transactions` from the inlined migrations.
- `npm run dev` serving on port 5000 (parsed from startup output: `serving on port 5000`).
- Pages: `GET /` -> 200, 172 KB rendered DOM (full Mantua.AI landing copy);
  `GET /app` -> 200, 160 KB DOM with Chat / Swap / Liquidity / Portfolio / Agent / Connect Wallet UI mounted.
- Chat CRUD: POST/GET/DELETE `/api/chat/sessions` and POST/GET `/api/chat/messages` all 200;
  rows verified directly in psql (`chat_sessions`, `chat_messages`).
- `GET /api/prices` -> 200 with live data (ETH $2489.77, USDC $0.999911 at capture time).
- Screenshots: `/tmp/shot-landing.png`, `/tmp/shot-app.png` (headless Chromium, in-sandbox).
- Unit tests: vitest **168 / 170 pass**; 5 files fail for pre-existing reasons (see Known issues).
- Typecheck: not runnable — no `tsconfig.json` committed (pre-existing gap).
- Verdict: **dev_stack_healthy: true** with evidence.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string, e.g. `postgres://mantua:mantua_local@127.0.0.1:5432/mantua` |
| `OPENAI_API_KEY` | yes (to boot) | `server/routes/chat.ts`, `server/routes.ts`, `server/routes/agentRoutes.ts` construct OpenAI clients at module load. Any non-empty value boots the server; a real key is only needed for `/api/voice/transcribe` and LLM chat replies. |
| `PORT` | no | Default 5000; server binds 127.0.0.1 |
| `NODE_ENV` | no | Set by the npm scripts |
| `BASE_SEPOLIA_RPC_URL` | no | Defaults to public `https://sepolia.base.org` |
| `COINGECKO_API_KEY` | no | Unauthenticated fallback works (verified) |
| `VITE_REOWN_PROJECT_ID` | no | Hardcoded fallback in `client/src/config/appkit.ts` |
| `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` / `CDP_WALLET_SECRET` | no | Coinbase AgentKit wallet. Missing -> startup warning only, server continues |
| `ANTHROPIC_API_KEY`, `DUNE_API_KEY`, `ANALYTICS_SECRET`, `BASESCAN_API_KEY`, `PRIVATE_KEY` | no | Feature-specific; see `.env.example`, `.env.contracts.example` |

`.env` is gitignored; build it from `.env.example` + local DB values. `tsx --env-file=.env` fails
to boot without it. See SKILL.md for the exact working `.env` used in this run.

## Sandbox snapshot

- Snapshot (captured live session): `i60m2a94khiwmpyxzu1jf`
- Built: **2026-09-03T15:35:38.394Z** (template `i0czgh5bte6283n3142i:default`)
- Baked in: PostgreSQL 17 + Chromium (apt), DB `mantua` migrated and schema-synced,
  `.env` present, dev server running on port 5000 at capture time.

## Known issues & gotchas

1. **Schema drift (blocks chat API on a fresh DB).** `server/db/migrate.ts` (5 inlined
   migrations) lags `shared/schema.ts`: it never creates `chat_sessions.wallet_address` /
   `context` or `chat_messages.input_type`, nor the `users` / `agent_actions` / `hook_events` /
   vault tables. Until you sync with `drizzle-kit push` (config pointing at `shared/schema.ts`;
   none is committed), every chat API call returns 500 (`column "wallet_address" ... does not exist`).
2. After `drizzle-kit push`, migration 004 fails (`positions(pool_id)` index — legacy table shape).
   Caught + logged; boot continues. Apply 005 manually:
   `ALTER TABLE pools ADD COLUMN IF NOT EXISTS hook_address VARCHAR(42) DEFAULT '0x0000000000000000000000000000000000000000';`
3. `npm run check` is a no-op: no `tsconfig.json` is committed, so bare `tsc` prints help. TODO(confirm): add one.
4. Test failures are pre-existing: `agent-flow-e2e.test.ts` and `testnet-e2e.test.ts` require
   `contracts/.env` (absent); `analyticsAgent.test.ts` imports missing `../routes/analyticsAgent`;
   `ChatMessageList.test.tsx` / `useChat.test.ts` have 2 component-vs-mock drift failures.
5. `forge` is not installed in this sandbox; contract build/test/deploy were NOT exercised.
   README claims 81 Foundry tests pass — TODO(confirm).
6. `GET /api/pools` falls through to the SPA shell (only POST is defined on the pools router).
7. README's deployment section references `script/00_DeployStableProtectionHook.s.sol` and
   siblings that do not exist in the repo; actual scripts live in `contracts/script/` (Solidity)
   and `scripts/` (TypeScript).
8. `.replit` `[userenv.shared]` contains committed CDP secrets — treat as exposed and rotate.
9. `node_modules` ships root-owned in the sandbox image; run
   `sudo chown -R user:user node_modules` before Vite can write its dep cache (EACCES otherwise).
10. Root `package.json` name is `rest-express` (Replit scaffold leftover).

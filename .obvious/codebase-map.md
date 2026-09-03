# Mantua.AI — Codebase Map

Folder-level overview (depth cap 2). The repo root is also a Foundry (Solidity) workspace.

| Path | What lives there |
|---|---|
| `client/` | React SPA entry: `index.html`, `public/` static assets, `replit_integrations/` |
| `client/src/` | App source: `App.tsx`, `main.tsx`, `pages/` (landing `/` + app home `/app`), `components/` (shadcn/ui + feature components), `hooks/`, `lib/` (e.g. `liquidityMath.ts`), `config/` (`appkit.ts`, token config), `services/`, `context/`, `abis/`, `types/`, `utils/`, `shims/`, `tests/` |
| `server/` | Express API: `index.ts` (bootstrap: migrations, AgentKit health, port bind), `routes.ts` (legacy registrations: users, chat, positions, agent-actions, hook-events, voice), `storage.ts` (Drizzle storage layer), `vite.ts` (dev middleware), `static.ts` (prod static), `db/` (`index.ts` pool, `migrate.ts` inlined SQL, `migrations/`), `routes/` (feature routers: `agent`, `agentRoutes`, `analytics`, `analyticsQuery`, `auth`, `chat`, `dune`, `pools`, `portfolio`, `prices`), `services/` (`coinGeckoService`, `duneService`, `intentRouter`, `poolService`, `voiceCommandParser`), `lib/` (`agentkit`, `analytics`, `rateLimiter`, `walletAuth`), `agent/` (intent parsing + corpora), `tests/` (vitest), `replit_integrations/` |
| `shared/` | Client/server-shared code: `schema.ts` (all Drizzle table definitions — ORM source of truth), `voiceCommandParser.ts`, `voiceCommandTypes.ts`, `models/chat.ts` |
| `contracts/` | Second Foundry workspace: `src/` (`faucet/`, `tokens/` mock tokens), `test/`, `script/DeployMockTokens.s.sol`, `prediction/`, `vaults/` (own `foundry.toml`), `out/` build artifacts, `.env.example` |
| `subgraph/` | The Graph subgraphs: `base-sepolia/`, `unichain-sepolia/` |
| `scripts/` | Operational TypeScript: agent e2e, wallet creation, hook deploy, pool creation, faucet, `testnet-e2e.ts`, `test-agent-flow.sh` |
| `script/` | `build.ts` — esbuild production bundler behind `npm run build` |
| `lib/` | Git submodules: `openzeppelin-contracts`, `stableprotection-hook` |
| `tests/` | `voiceCommandParser.test.mjs` (plain Node test) |
| `.agents/skills/`, `.claude/skills/` | Domain skill guides: configurator, deployer, liquidity-planner, swap-integration, swap-planner, v4-security-foundations, viem-integration |
| `attached_assets/` | Design screenshots and prompt archives — reference material, not code |
| `docs/` | `agent-transfer-result.json` |
| `cache/`, `out/` | Foundry build/cache artifacts |
| Root files | `package.json`, `vite.config.ts`, `vitest.config.ts` + `vitest.setup.ts`, `foundry.toml` + `remappings.txt` (root Uniswap V4 hook workspace), `StableProtectionHook.sol` (empty placeholder), `README.md`, `replit.md`, `DEPLOYMENT_GUIDE.md`, `.replit`, `.gitmodules`, `.env.example`, `.env.contracts.example`, `.env.local`, `skills-lock.json` |

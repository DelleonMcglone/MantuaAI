---
name: local-dev
description: Bring the Mantua.AI local dev stack up (Postgres, .env, schema sync, npm run dev) and verify it end-to-end. Reproduces the 2026-09-03 onboarding run.
---

# Local dev — Mantua.AI

Goal: `dev_stack_healthy: true` — Express+Vite dev server on port 5000, Postgres-backed
chat CRUD working, pages rendering.

## What the sandbox snapshot already has

The 2026-09-03 snapshot (`i60m2a94khiwmpyxzu1jf`, template `i0czgh5bte6283n3142i:default`)
baked in: PostgreSQL 17 + Chromium (apt), DB `mantua` (role `mantua` / password
`mantua_local`) already migrated and schema-synced, `.env` present, dev server was running.
If the sandbox was recycled (fresh rootfs: `pg_lsclusters` missing, `.env` gone,
`node_modules` root-owned again), rebuild with the steps below — everything outside
`/home/user/work/MantuaAI` is per-instance and ephemeral.

## Rebuild from scratch (fresh instance)

```bash
# 1. System deps (rootfs is ephemeral per sandbox instance)
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  postgresql chromium fonts-liberation fonts-dejavu-core

# 2. Postgres up + role/db
sudo pg_ctlcluster 17 main start
sudo -u postgres psql -c "CREATE ROLE mantua LOGIN PASSWORD 'mantua_local';"
sudo -u postgres psql -c "CREATE DATABASE mantua OWNER mantua;"

# 3. node_modules ships root-owned — Vite needs to write node_modules/.vite
sudo chown -R user:user node_modules

# 4. .env (gitignored; tsx --env-file=.env refuses to boot without it)
#    DATABASE_URL=postgres://mantua:mantua_local@127.0.0.1:5432/mantua
#    PORT=5000
#    BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
#    OPENAI_API_KEY=<any non-empty dummy — module-level OpenAI clients must construct>
#    (see .obvious/obvious.md env table for the full optional set)

# 5. Sync DB to shared/schema.ts — the inlined migrations lag the ORM schema and
#    the chat API 500s until this is done. No drizzle.config.ts is committed, so use one in /tmp:
cat > /tmp/drizzle.config.ts <<'CFG'
export default {
  dialect: 'postgresql',
  schema: '/home/user/work/MantuaAI/shared/schema.ts',
  out: '/tmp/drizzle-out',
  dbCredentials: { url: 'postgres://mantua:mantua_local@127.0.0.1:5432/mantua' },
};
CFG
node_modules/.bin/drizzle-kit push --config=/tmp/drizzle.config.ts --force

# 6. Migration 005 never runs (004 aborts the loop on drizzle-shaped tables) — apply manually:
PGPASSWORD=mantua_local psql -h 127.0.0.1 -U mantua -d mantua -c \
  "ALTER TABLE pools ADD COLUMN IF NOT EXISTS hook_address VARCHAR(42) DEFAULT '0x0000000000000000000000000000000000000000';"

# 7. Start the canonical dev command
nohup npm run dev > /tmp/mantua-dev.log 2>&1 & disown
```

## Verify

- Log shows `[migrate] Applied: 001..003` (004 failure is expected + harmless) and
  `serving on port 5000`.
- `curl http://127.0.0.1:5000/` -> 200; `/app` -> 200 (SPA).
- Chat CRUD (all 200, persisted in Postgres):
  POST `/api/chat/sessions` `{"title":"smoke","userId":"u1"}` (returns `{"session":{"id":...}}`;
  a body WITHOUT `userId` falls through to the legacy handler which returns the session flat),
  POST `/api/chat/messages` `{"sessionId":"<id>","role":"user","content":"..."}`,
  GET `/api/chat/messages/<id>`, GET `/api/chat/sessions`, DELETE `/api/chat/sessions/<id>`.
- GET `/api/prices` -> 200 live CoinGecko data (no key needed).
- Screenshots: `chromium --headless=new --no-sandbox --disable-gpu --window-size=1440,900 \
  --virtual-time-budget=12000 --screenshot=/tmp/shot.png http://127.0.0.1:5000/`
- Tests: `npm test` — expect 168/170 passing; the 5 failing files fail for pre-existing
  repo reasons (see obvious.md Known issues), not environment reasons.

## Gotchas

- `OPENAI_API_KEY` must be non-empty or the server crashes at import (module-level
  `new OpenAI(...)` in `server/routes/chat.ts`, `server/routes.ts`, `server/routes/agentRoutes.ts`).
  A dummy value boots fine; only voice transcription and LLM replies need a real key.
- Missing `CDP_*` keys only disable the AgentKit wallet (startup warning, non-fatal).
- Never `pkill -f 'tsx --env-file'` — the pattern matches your own shell; use
  `pkill -f '[s]erver/index.ts'`.
- `npm run check` (tsc) is a no-op — no tsconfig.json is committed.
- `forge` is not installed; contract workflows are out of scope for local dev here.

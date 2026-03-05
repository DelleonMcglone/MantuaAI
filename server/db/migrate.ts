// Migration runner: executes SQL migrations against the connected database.
// Migrations are inlined to avoid filesystem path issues in bundled (CJS) deployments.
import pkg from "pg";
const { Pool } = pkg;

const MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: '001_chat_schema.sql',
    sql: `
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64),
  title VARCHAR(255) DEFAULT 'New Chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB;
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
`,
  },
  {
    name: '002_analytics_events.sql',
    sql: `
CREATE TABLE IF NOT EXISTS analytics_events (
  id          SERIAL PRIMARY KEY,
  event       VARCHAR(100) NOT NULL,
  wallet_hash VARCHAR(64),
  properties  JSONB,
  session_id  VARCHAR(100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event      ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_wallet     ON analytics_events(wallet_hash);
`,
  },
  {
    name: '003_pools_portfolio.sql',
    sql: `
CREATE TABLE IF NOT EXISTS pools (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token0      VARCHAR(10) NOT NULL,
  token1      VARCHAR(10) NOT NULL,
  fee_tier    INTEGER     NOT NULL,
  creator_address VARCHAR(42) NOT NULL,
  tx_hash     VARCHAR(66) NOT NULL,
  chain_id    INTEGER     NOT NULL DEFAULT 84532,
  created_at  TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pools_chain ON pools(chain_id);
CREATE INDEX IF NOT EXISTS idx_pools_creator ON pools(creator_address);
CREATE TABLE IF NOT EXISTS portfolio_transactions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  VARCHAR(42) NOT NULL,
  type            VARCHAR(30) NOT NULL,
  tx_hash         VARCHAR(66) NOT NULL UNIQUE,
  token_in        VARCHAR(10),
  token_out       VARCHAR(10),
  amount_in       DECIMAL(36,18),
  amount_out      DECIMAL(36,18),
  pool_id         UUID        REFERENCES pools(id),
  chain_id        INTEGER     NOT NULL DEFAULT 84532,
  base_scan_url   TEXT        NOT NULL,
  timestamp       TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_wallet ON portfolio_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_portfolio_ts     ON portfolio_transactions(timestamp DESC);
CREATE TABLE IF NOT EXISTS agent_wallets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR(42) NOT NULL,
  wallet_id   VARCHAR(255) NOT NULL UNIQUE,
  address     VARCHAR(42)  NOT NULL,
  chain_id    INTEGER      NOT NULL DEFAULT 84532,
  created_at  TIMESTAMP    DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_wallets_user ON agent_wallets(user_id);
CREATE TABLE IF NOT EXISTS agent_portfolio_transactions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_wallet_id UUID        REFERENCES agent_wallets(id),
  type            VARCHAR(30) NOT NULL,
  tx_hash         VARCHAR(66) NOT NULL UNIQUE,
  token_in        VARCHAR(10),
  token_out       VARCHAR(10),
  amount_in       DECIMAL(36,18),
  amount_out      DECIMAL(36,18),
  chain_id        INTEGER     NOT NULL DEFAULT 84532,
  base_scan_url   TEXT        NOT NULL,
  timestamp       TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_portfolio_wallet ON agent_portfolio_transactions(agent_wallet_id);
`,
  },
  {
    name: '004_positions_lp.sql',
    sql: `
ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS position_token_id BIGINT,
  ADD COLUMN IF NOT EXISTS pool_id UUID REFERENCES pools(id),
  ADD COLUMN IF NOT EXISTS fee_tier INTEGER,
  ADD COLUMN IF NOT EXISTS amount0 DECIMAL(36,18),
  ADD COLUMN IF NOT EXISTS amount1 DECIMAL(36,18),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_positions_wallet ON positions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_positions_pool_id ON positions(pool_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
`,
  },
  {
    name: '005_pools_hook_address.sql',
    sql: `
ALTER TABLE pools ADD COLUMN IF NOT EXISTS hook_address VARCHAR(42) DEFAULT '0x0000000000000000000000000000000000000000';
`,
  },
];

export async function runMigrations(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const migration of MIGRATIONS) {
      await pool.query(migration.sql);
      console.log(`[migrate] Applied: ${migration.name}`);
    }
  } catch (err) {
    console.error("[migrate] Migration failed:", err);
    throw err;
  } finally {
    await pool.end();
  }
}

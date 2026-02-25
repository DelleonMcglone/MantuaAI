-- Migration: pools and portfolio tables for Mantua.AI v2

-- Pools created by users on-chain
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

-- User portfolio transactions
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

-- Agent wallets (CDP MPC wallets)
CREATE TABLE IF NOT EXISTS agent_wallets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR(42) NOT NULL,
  wallet_id   VARCHAR(255) NOT NULL UNIQUE,
  address     VARCHAR(42)  NOT NULL,
  chain_id    INTEGER      NOT NULL DEFAULT 84532,
  created_at  TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_wallets_user ON agent_wallets(user_id);

-- Agent portfolio transactions
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

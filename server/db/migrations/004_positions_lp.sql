-- Migration: LP positions table for Uniswap v4

CREATE TABLE IF NOT EXISTS positions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address   VARCHAR(42) NOT NULL,
  pool_id          UUID        REFERENCES pools(id),
  position_token_id BIGINT,
  token0           VARCHAR(10) NOT NULL,
  token1           VARCHAR(10) NOT NULL,
  liquidity        DECIMAL(36,18) NOT NULL DEFAULT 0,
  amount0          DECIMAL(36,18) DEFAULT 0,
  amount1          DECIMAL(36,18) DEFAULT 0,
  fee_tier         INTEGER,
  pool_address     VARCHAR(42) DEFAULT '0x0000000000000000000000000000000000000000',
  tick_lower       INTEGER DEFAULT 0,
  tick_upper       INTEGER DEFAULT 0,
  status           TEXT DEFAULT 'active',
  chain_id         INTEGER NOT NULL DEFAULT 84532,
  hook_address     VARCHAR(42) DEFAULT '0x0000000000000000000000000000000000000000',
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_positions_wallet ON positions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_positions_pool_id ON positions(pool_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);

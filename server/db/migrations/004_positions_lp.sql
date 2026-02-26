-- Migration: enhanced LP positions table with position_token_id for Uniswap v4

-- Add position_token_id to existing positions table if it doesn't have it
ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS position_token_id BIGINT,
  ADD COLUMN IF NOT EXISTS pool_id UUID REFERENCES pools(id),
  ADD COLUMN IF NOT EXISTS fee_tier INTEGER,
  ADD COLUMN IF NOT EXISTS amount0 DECIMAL(36,18),
  ADD COLUMN IF NOT EXISTS amount1 DECIMAL(36,18),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Update status check constraint to include 'closed'
-- (The original table already has status TEXT DEFAULT 'active')

CREATE INDEX IF NOT EXISTS idx_positions_wallet ON positions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_positions_pool_id ON positions(pool_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);

-- Ensure positions table has all required columns for full LP tracking
-- This is idempotent (IF NOT EXISTS guards)

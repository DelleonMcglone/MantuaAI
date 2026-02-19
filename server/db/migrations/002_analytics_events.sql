-- Analytics events migration — idempotent
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

CREATE TABLE IF NOT EXISTS price_alerts (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  userId integer NOT NULL,
  ticker text NOT NULL,
  targetPrice text NOT NULL,
  direction text NOT NULL,
  triggered integer NOT NULL DEFAULT 0,
  createdAt text DEFAULT (datetime('now')) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON price_alerts(userId, triggered);

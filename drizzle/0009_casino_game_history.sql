CREATE TABLE IF NOT EXISTS casino_game_history (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  userId integer NOT NULL,
  gameType text NOT NULL,
  bet text NOT NULL,
  payout text NOT NULL,
  result text NOT NULL,
  multiplier text,
  createdAt text DEFAULT (datetime('now')) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_casino_history_user ON casino_game_history(userId, createdAt DESC);

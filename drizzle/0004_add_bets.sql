CREATE TABLE IF NOT EXISTS `bets` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `userId` integer NOT NULL,
  `prediction` text NOT NULL,
  `amount` text NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `matchId` text,
  `payout` text,
  `createdAt` text DEFAULT (datetime('now')) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bets_userId ON bets(userId);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);

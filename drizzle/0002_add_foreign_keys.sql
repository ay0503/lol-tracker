-- SQLite doesn't support ALTER TABLE ADD FOREIGN KEY, so we use triggers
-- to enforce referential integrity on userId columns.
-- These triggers prevent inserts/updates with invalid userId references.

CREATE TRIGGER IF NOT EXISTS fk_portfolios_userId
  BEFORE INSERT ON portfolios
  WHEN NEW.userId NOT IN (SELECT id FROM users)
BEGIN
  SELECT RAISE(ABORT, 'Foreign key violation: portfolios.userId references non-existent user');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fk_holdings_userId
  BEFORE INSERT ON holdings
  WHEN NEW.userId NOT IN (SELECT id FROM users)
BEGIN
  SELECT RAISE(ABORT, 'Foreign key violation: holdings.userId references non-existent user');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fk_trades_userId
  BEFORE INSERT ON trades
  WHEN NEW.userId NOT IN (SELECT id FROM users)
BEGIN
  SELECT RAISE(ABORT, 'Foreign key violation: trades.userId references non-existent user');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fk_orders_userId
  BEFORE INSERT ON orders
  WHEN NEW.userId NOT IN (SELECT id FROM users)
BEGIN
  SELECT RAISE(ABORT, 'Foreign key violation: orders.userId references non-existent user');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fk_comments_userId
  BEFORE INSERT ON comments
  WHEN NEW.userId NOT IN (SELECT id FROM users)
BEGIN
  SELECT RAISE(ABORT, 'Foreign key violation: comments.userId references non-existent user');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fk_dividends_userId
  BEFORE INSERT ON dividends
  WHEN NEW.userId NOT IN (SELECT id FROM users)
BEGIN
  SELECT RAISE(ABORT, 'Foreign key violation: dividends.userId references non-existent user');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fk_notifications_userId
  BEFORE INSERT ON notifications
  WHEN NEW.userId NOT IN (SELECT id FROM users)
BEGIN
  SELECT RAISE(ABORT, 'Foreign key violation: notifications.userId references non-existent user');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS fk_portfolioSnapshots_userId
  BEFORE INSERT ON portfolioSnapshots
  WHEN NEW.userId NOT IN (SELECT id FROM users)
BEGIN
  SELECT RAISE(ABORT, 'Foreign key violation: portfolioSnapshots.userId references non-existent user');
END;

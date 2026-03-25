CREATE INDEX IF NOT EXISTS `idx_holdings_user_ticker` ON `holdings` (`userId`, `ticker`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_trades_user_created` ON `trades` (`userId`, `createdAt`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_orders_status` ON `orders` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_orders_user_status` ON `orders` (`userId`, `status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_priceHistory_timestamp` ON `priceHistory` (`timestamp`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_portfolioSnapshots_user_timestamp` ON `portfolioSnapshots` (`userId`, `timestamp`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_notifications_user_read` ON `notifications` (`userId`, `read`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_comments_created` ON `comments` (`createdAt`);

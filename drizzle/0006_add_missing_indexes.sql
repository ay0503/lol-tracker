-- Sprint 3: Add missing indexes for common query patterns
CREATE INDEX IF NOT EXISTS `idx_dividends_user_created` ON `dividends` (`userId`, `createdAt`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_matches_gameCreation` ON `matches` (`gameCreation`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_news_created` ON `news` (`createdAt`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_notifications_user_created` ON `notifications` (`userId`, `createdAt`);

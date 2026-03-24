CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`ticker` text,
	`content` text NOT NULL,
	`sentiment` text DEFAULT 'neutral' NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dividends` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`ticker` text NOT NULL,
	`shares` text NOT NULL,
	`dividendPerShare` text NOT NULL,
	`totalPayout` text NOT NULL,
	`reason` text NOT NULL,
	`matchId` text,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `holdings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`ticker` text NOT NULL,
	`shares` text DEFAULT '0.0000' NOT NULL,
	`avgCostBasis` text DEFAULT '0.0000' NOT NULL,
	`shortShares` text DEFAULT '0.0000' NOT NULL,
	`shortAvgPrice` text DEFAULT '0.0000' NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `marketStatus` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`isOpen` integer DEFAULT false NOT NULL,
	`reason` text,
	`lastActivity` text,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`matchId` text NOT NULL,
	`win` integer NOT NULL,
	`champion` text NOT NULL,
	`kills` integer NOT NULL,
	`deaths` integer NOT NULL,
	`assists` integer NOT NULL,
	`cs` integer DEFAULT 0 NOT NULL,
	`position` text,
	`gameDuration` integer NOT NULL,
	`priceBefore` text,
	`priceAfter` text,
	`dividendsPaid` integer DEFAULT false NOT NULL,
	`newsGenerated` integer DEFAULT false NOT NULL,
	`gameCreation` integer NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matches_matchId_unique` ON `matches` (`matchId`);--> statement-breakpoint
CREATE TABLE `news` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`headline` text NOT NULL,
	`body` text,
	`matchId` text,
	`isWin` integer,
	`champion` text,
	`kda` text,
	`priceChange` text,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`relatedId` integer,
	`read` integer DEFAULT false NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`ticker` text NOT NULL,
	`orderType` text NOT NULL,
	`shares` text NOT NULL,
	`targetPrice` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`filledAt` text,
	`filledPrice` text,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `portfolioSnapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`totalValue` text NOT NULL,
	`cashBalance` text NOT NULL,
	`holdingsValue` text NOT NULL,
	`shortPnl` text DEFAULT '0.00' NOT NULL,
	`timestamp` integer NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `portfolios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`cashBalance` text DEFAULT '200.00' NOT NULL,
	`totalDividends` text DEFAULT '0.00' NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portfolios_userId_unique` ON `portfolios` (`userId`);--> statement-breakpoint
CREATE TABLE `priceHistory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` integer NOT NULL,
	`tier` text NOT NULL,
	`division` text NOT NULL,
	`lp` integer NOT NULL,
	`totalLP` integer NOT NULL,
	`price` text NOT NULL,
	`wins` integer,
	`losses` integer,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`ticker` text DEFAULT 'DORI' NOT NULL,
	`type` text NOT NULL,
	`shares` text NOT NULL,
	`pricePerShare` text NOT NULL,
	`totalAmount` text NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text NOT NULL,
	`name` text,
	`displayName` text,
	`email` text,
	`passwordHash` text,
	`loginMethod` text,
	`role` text DEFAULT 'user' NOT NULL,
	`createdAt` text DEFAULT (datetime('now')) NOT NULL,
	`updatedAt` text DEFAULT (datetime('now')) NOT NULL,
	`lastSignedIn` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
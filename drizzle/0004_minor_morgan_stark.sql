CREATE TABLE `comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ticker` varchar(10),
	`content` text NOT NULL,
	`sentiment` enum('bullish','bearish','neutral') NOT NULL DEFAULT 'neutral',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dividends` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ticker` varchar(10) NOT NULL,
	`shares` decimal(12,4) NOT NULL,
	`dividendPerShare` decimal(8,4) NOT NULL,
	`totalPayout` decimal(12,2) NOT NULL,
	`reason` varchar(100) NOT NULL,
	`matchId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dividends_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketStatus` (
	`id` int AUTO_INCREMENT NOT NULL,
	`isOpen` boolean NOT NULL DEFAULT false,
	`reason` varchar(200),
	`lastActivity` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketStatus_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`matchId` varchar(64) NOT NULL,
	`win` boolean NOT NULL,
	`champion` varchar(32) NOT NULL,
	`kills` int NOT NULL,
	`deaths` int NOT NULL,
	`assists` int NOT NULL,
	`cs` int NOT NULL DEFAULT 0,
	`position` varchar(16),
	`gameDuration` int NOT NULL,
	`priceBefore` decimal(8,4),
	`priceAfter` decimal(8,4),
	`dividendsPaid` boolean NOT NULL DEFAULT false,
	`newsGenerated` boolean NOT NULL DEFAULT false,
	`gameCreation` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `matches_id` PRIMARY KEY(`id`),
	CONSTRAINT `matches_matchId_unique` UNIQUE(`matchId`)
);
--> statement-breakpoint
CREATE TABLE `news` (
	`id` int AUTO_INCREMENT NOT NULL,
	`headline` varchar(500) NOT NULL,
	`body` text,
	`matchId` varchar(64),
	`isWin` boolean,
	`champion` varchar(32),
	`kda` varchar(32),
	`priceChange` decimal(8,4),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `news_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ticker` varchar(10) NOT NULL,
	`orderType` enum('limit_buy','limit_sell','stop_loss') NOT NULL,
	`shares` decimal(12,4) NOT NULL,
	`targetPrice` decimal(8,4) NOT NULL,
	`status` enum('pending','filled','cancelled','expired') NOT NULL DEFAULT 'pending',
	`filledAt` timestamp,
	`filledPrice` decimal(8,4),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `trades` MODIFY COLUMN `type` enum('buy','sell','short','cover','dividend') NOT NULL;--> statement-breakpoint
ALTER TABLE `holdings` ADD `shortShares` decimal(12,4) DEFAULT '0.0000' NOT NULL;--> statement-breakpoint
ALTER TABLE `holdings` ADD `shortAvgPrice` decimal(12,4) DEFAULT '0.0000' NOT NULL;--> statement-breakpoint
ALTER TABLE `portfolios` ADD `totalDividends` decimal(12,2) DEFAULT '0.00' NOT NULL;
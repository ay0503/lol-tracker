CREATE TABLE `holdings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`ticker` varchar(10) NOT NULL,
	`shares` decimal(12,4) NOT NULL DEFAULT '0.0000',
	`avgCostBasis` decimal(12,4) NOT NULL DEFAULT '0.0000',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `holdings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `priceHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timestamp` bigint NOT NULL,
	`tier` varchar(20) NOT NULL,
	`division` varchar(5) NOT NULL,
	`lp` int NOT NULL,
	`totalLP` int NOT NULL,
	`price` decimal(8,4) NOT NULL,
	`wins` int,
	`losses` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `priceHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `trades` MODIFY COLUMN `pricePerShare` decimal(12,4) NOT NULL;--> statement-breakpoint
ALTER TABLE `trades` ADD `ticker` varchar(10) DEFAULT 'DORI' NOT NULL;--> statement-breakpoint
ALTER TABLE `portfolios` DROP COLUMN `sharesOwned`;
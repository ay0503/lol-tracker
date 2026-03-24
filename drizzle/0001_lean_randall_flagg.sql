CREATE TABLE `portfolios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cashBalance` decimal(12,2) NOT NULL DEFAULT '200.00',
	`sharesOwned` decimal(12,4) NOT NULL DEFAULT '0.0000',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolios_id` PRIMARY KEY(`id`),
	CONSTRAINT `portfolios_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('buy','sell') NOT NULL,
	`shares` decimal(12,4) NOT NULL,
	`pricePerShare` decimal(12,2) NOT NULL,
	`totalAmount` decimal(12,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trades_id` PRIMARY KEY(`id`)
);

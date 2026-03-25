ALTER TABLE `marketStatus` ADD `adminHalt` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `isRemake` integer DEFAULT false NOT NULL;
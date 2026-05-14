CREATE TABLE `conversions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`partNumbers` json NOT NULL,
	`options` json NOT NULL,
	`status` enum('pending','running','done','error') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`zipKey` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversions_id` PRIMARY KEY(`id`)
);

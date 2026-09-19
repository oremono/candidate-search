CREATE TABLE `candidates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`full_time` integer NOT NULL,
	`full_time_start_date` integer,
	`full_time_monthly_rate` integer,
	`part_time` integer NOT NULL,
	`part_time_start_date` integer,
	`part_time_monthly_rate` integer,
	`contractor` integer NOT NULL,
	`employee` integer NOT NULL,
	`country` text NOT NULL,
	`biography` text
);
--> statement-breakpoint
CREATE TABLE `education` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`candidate_id` integer NOT NULL,
	`school` text NOT NULL,
	`degree` text NOT NULL,
	`start_date` integer,
	`end_date` integer,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `experiences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`candidate_id` integer NOT NULL,
	`company` text NOT NULL,
	`position` text NOT NULL,
	`description` text,
	`start_date` integer,
	`end_date` integer,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action
);

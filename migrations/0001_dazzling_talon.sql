CREATE TABLE `candidate_skills` (
	`candidate_id` integer NOT NULL,
	`skill` text NOT NULL,
	`in_bio` integer NOT NULL,
	`role_count` integer NOT NULL,
	PRIMARY KEY(`candidate_id`, `skill`),
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `candidate_skills_skill_idx` ON `candidate_skills` (`skill`);--> statement-breakpoint
ALTER TABLE `candidates` ADD `years_experience` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `candidates` ADD `full_time_rate_normalized` integer;--> statement-breakpoint
ALTER TABLE `candidates` ADD `part_time_rate_normalized` integer;--> statement-breakpoint
ALTER TABLE `candidates` ADD `rate_unverified` integer DEFAULT false NOT NULL;
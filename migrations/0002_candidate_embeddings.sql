CREATE TABLE `candidate_embeddings` (
	`candidate_id` integer PRIMARY KEY NOT NULL,
	`embedding` F32_BLOB(1536) NOT NULL,
	`content_hash` text NOT NULL,
	`model` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action
);

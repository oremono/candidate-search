-- Custom SQL migration file, put your code below! --
-- Keyword index over resumes. Rebuilt by `npm run db:seed` (see src/lib/search/keyword.ts).
CREATE VIRTUAL TABLE `candidate_search` USING fts5(
	candidate_id UNINDEXED,
	biography,
	experience,
	education,
	tokenize = 'porter unicode61'
);

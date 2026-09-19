# S2: Search index (keyword + embeddings)

Status: spec ready. Backend only; no UI.

## Goal

Make resumes searchable two ways, for use by ranking (S5) and natural-language search (S4):

- **Keyword search:** SQLite FTS5 with bm25 scores, plus a snippet that marks the matched words.
- **Semantic search:** one OpenAI embedding per candidate, stored in libsql's native `F32_BLOB` column type and compared with `vector_distance_cos`. Both were checked and work locally.

Everything has to be built by `npm run db:seed`, so a clean checkout works.

## Rules for agents

- **Test agent:** writes only under `tests/s2/`. Doesn't open the implementation files listed below.
- **Implementation agent:** never opens, lists or runs anything under `tests/`, and never runs `npm test` or `vitest`.
- Neither agent changes `src/lib/contracts.ts` or this spec.

## API contract

```ts
// src/lib/search/document.ts
export interface ResumeParts {
  biography: string;
  experiences: { position: string; company: string; description: string }[];
  education: { degree: string; school: string }[];
}
export const MAX_DOCUMENT_CHARS = 6000;
export function buildResumeDocument(parts: ResumeParts): string;

// src/lib/search/keyword.ts
export function toFtsQuery(input: string): string | null;
export interface KeywordHit {
  candidateId: number;
  score: number; // > 0, higher = better
  snippet: string; // matched words wrapped in ⟪ ⟫
}
export function keywordSearch(
  query: string,
  options?: { limit?: number; candidateIds?: number[] }
): Promise<KeywordHit[]>;

// src/lib/search/semantic.ts
export interface SemanticHit {
  candidateId: number;
  similarity: number; // 1 - cosine distance, higher = better
}
export function semanticSearch(
  queryVector: number[],
  options?: { limit?: number; candidateIds?: number[] }
): Promise<SemanticHit[]>;

// src/db/embed.ts (also the `npm run db:embed` entry point)
export function embedCandidates(options?: {
  force?: boolean;
}): Promise<{ embedded: number; skipped: number }>;
```

## Rules

### buildResumeDocument

The document is built in this layout. A section is left out entirely when it has no entries. Every line is trimmed.

```
{biography}

Experience:
- {position} at {company}: {description}

Education:
- {degree}, {school}
```

- An experience with an empty description drops the `: {description}` part.
- An education entry with a blank degree becomes `- {school}`.
- An empty biography drops its line and the blank line after it, so the document starts at `Experience:`.
- Output longer than `MAX_DOCUMENT_CHARS` is cut to exactly that length.

### toFtsQuery

1. Lowercase the input and take the tokens matching `/[\p{L}\p{N}][\p{L}\p{N}+#.]*/gu`.
2. Strip trailing `.` from each token.
3. Keep tokens that are at least 2 characters long or contain `+` or `#`.
4. Remove duplicates, keeping first-seen order.
5. Wrap each token in double quotes and join with `' OR '` (space, OR, space).
6. If no tokens are left, return `null`.

FTS operators such as `NOT`, `AND` and `NEAR` become plain quoted words.

### keywordSearch

- An FTS5 table `candidate_search` with columns `candidate_id UNINDEXED`, `biography`, `experience` and `education`, tokenizer `porter unicode61`:
  - `experience` is every position and description, joined with newlines.
  - `education` is every degree and school.
- `score = -bm25(...)`.
- `snippet(candidate_search, -1, '⟪', '⟫', '…', 12)`.
- Results are sorted by score, highest first. The default limit is 50. `candidateIds` restricts the results to those ids; an empty array gives `[]`.
- If `toFtsQuery` returns `null`, the result is `[]` with no query run.

### semanticSearch

- A table `candidate_embeddings` with columns:
  - `candidate_id`: integer, primary key, FK to candidates.
  - `embedding`: `F32_BLOB(1536)`, not null.
  - `content_hash`: text, not null.
  - `model`: text, not null.
- A Drizzle `customType` is fine for the embedding column. No vector index is needed at 1,000 rows.
- `similarity = 1 - vector_distance_cos(embedding, vector32(?))`. Results are sorted by similarity, highest first. The default limit is 50. `candidateIds` works the same way as in keyword search.

### embedCandidates / db:embed / seed

- Loads `.env` with `process.loadEnvFile()` if the file exists, because tsx doesn't load it on its own.
- `content_hash` = sha256 hex of `model + '\n' + document`.
- It skips candidates whose stored hash already matches, unless `force` is set. It embeds the rest in batches of 100 using `embed()` from `src/lib/openai.ts`, then upserts them.
- `npm run db:embed`: runs `embedCandidates()` and prints the counts. `npm run db:embed -- --force` re-embeds everyone.
- Seed:
  1. After S1's derive step, rebuild `candidate_search` (delete all rows, then insert).
  2. If `OPENAI_API_KEY` is set and isn't the placeholder, call `embedCandidates()`. Otherwise print `Skipping embeddings: OPENAI_API_KEY not set. Run npm run db:embed later.`
  3. If the embedding API call fails, print a warning and exit with code 0, so seeding still counts as a success.
- `--force` also clears `candidate_embeddings` and `candidate_search`, because candidate ids change on reset.
- The FTS table comes from a custom migration (`npx drizzle-kit generate --custom`); the embeddings table comes from the Drizzle schema.
- Update `README.md` "Scripts" with `db:embed`.

## Clarifications (added after the test pass)
- Cutting at `MAX_DOCUMENT_CHARS` keeps the **first** 6000 characters.
- `keywordSearch` / `semanticSearch` with `candidateIds` return only hits whose id is in that list, still sorted, still limited.

## Test list (input → expected)

**buildResumeDocument**

1. Bio "Rust dev", one experience (Engineer, Acme, "Built APIs"), one education (BSc CS, MIT) →
   `"Rust dev\n\nExperience:\n- Engineer at Acme: Built APIs\n\nEducation:\n- BSc CS, MIT"`.
2. Experience with an empty description → `- Engineer at Acme`.
3. Education with degree `" "` → `- MIT`.
4. No experiences and no education → just the bio.
5. Empty bio with one experience → starts with `Experience:`.
6. A 10,000-character bio → length is exactly 6000.

**toFtsQuery**

7. `'Rust'` → `'"rust"'`.
8. `'AI/ML engineer'` → `'"ai" OR "ml" OR "engineer"'`.
9. `'C++ and C#'` → `'"c++" OR "and" OR "c#"'`.
10. `'node.js.'` → `'"node.js"'`.
11. `'NOT rust'` → `'"not" OR "rust"'`.
12. `'rust Rust RUST'` → `'"rust"'`.
13. `''`, `'   '`, `'a'`, `'"; --'` → `null`.

**keywordSearch** (against `local.db`; skip the suite if it's missing)

14. `'rust'` → at least 5 hits, every snippet contains `⟪`, and scores are positive and sorted from highest to lowest.
15. `'zzzqqqxx'` → `[]`.
16. `''` → `[]`.
17. `'python'` with `limit: 3` → exactly 3 hits.
18. `'python'` with `candidateIds` set to the first 2 ids from hit 17 → only those ids come back.
19. `candidate_search` has 1,000 rows.

**semanticSearch** (against `local.db`; skip if `candidate_embeddings` is empty)

20. `candidate_embeddings` has 1,000 rows, and every `model` is `text-embedding-3-small`.
21. Read candidate X's stored vector with `vector_extract(embedding)` and pass it to `semanticSearch` → X comes first with `similarity > 0.999`, and similarities are sorted from highest to lowest.
22. `limit: 5` → exactly 5 hits. `candidateIds: []` → `[]`.

## Files owned

- Implementation:
  - `src/lib/search/document.ts`, `keyword.ts`, `semantic.ts`
  - `src/db/embed.ts`, `src/db/schema.ts`, `src/db/seed.ts`
  - new migrations
  - `package.json` scripts (`db:embed` only)
  - `README.md`, "Scripts" section only
- Tests: `tests/s2/*`.

## Done checklist

- [ ] tests written (test agent)
- [ ] implementation passes; `rm local.db && npm run db:seed` builds the FTS table and the embeddings
- [ ] typecheck + lint clean
- [ ] committed + PROGRESS.md updated

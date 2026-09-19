# S5: Ranking + explanations

Status: spec ready. **S5-back** only. The UI for its output (interpretation chips, relaxation notice, snippets) is S4-front.

## Goal
When a free-text query is present, rank the candidates that pass the hard filters by combining three signals:
- **semantic:** resume embedding similarity
- **keyword:** FTS5 bm25 on the leftover keywords
- **skill evidence**

Explain each result in plain words. When the query's own constraints leave nothing, drop them one at a time and say so, rather than showing an empty page. Without a query, behaviour is exactly S3's.

## Rules for agents
- **Test agent:** writes only under `tests/s5/`. Never opens implementation files.
- **Implementation agent:** never opens, lists or runs anything under `tests/`, and never runs `npm test` or `vitest`.
- Nobody changes `src/lib/contracts.ts`, `src/mocks/*` or this spec.
- The route is S4-back's. S5-back only changes `searchCandidates`.

## API contract

```ts
// src/lib/search/filter-search.ts (extend; S3 behaviour unchanged when options.query is absent)
export interface SearchOptions {
  /** Parsed free-text query (S4). Absent/null → plain S3 filter search. */
  query?: ParsedQuery | null;
  /** The raw query text, echoed as `response.query` (trimmed). */
  queryText?: string;
  /** Filter fields that came from the query and may be dropped if nothing matches. */
  relaxable?: (keyof SearchFilters)[];
  /** Embeds text for semantic search. Default: `embed()` from src/lib/openai.ts. Injectable for tests. */
  embedQuery?: (text: string) => Promise<number[]>;
}
export function searchCandidates(
  filters: SearchFilters,
  options?: SearchOptions
): Promise<SearchResponse>;
```

Reuse `keywordSearch` and `semanticSearch` from S2 (`src/lib/search/keyword.ts`, `semantic.ts`) and the S3 SQL filtering. Don't duplicate them.

## Rules

### Without a query
If `options.query` is absent or null, the result is exactly as in S3, plus `query: null`, `interpretation: null` and `relaxed: []`. The S3 tests must keep passing.

### With a query
1. **Candidate set:** every candidate that passes the hard filters (S3 filtering rules), with no top-10 cut. `total` = the size of this set.
2. **Relaxation:** only when the set is **empty** and `relaxable` isn't empty.
   - Drop the relaxable constraints one step at a time, in this order: `countries`, `maxSalary`, `minSalary`, `maxYears`, `minYears`, then `skills` one skill at a time, starting from the **last** one.
   - Skip fields that aren't in `relaxable`, or that are already empty or null.
   - After each step, recompute the set, and stop as soon as it's non-empty.
   - Each step appends one `Relaxation`, with salary written like `$130,000/yr`:

     | Field | Message |
     |---|---|
     | countries | `No candidates in {A or B} match, so country was ignored.` (names joined with ` or `) |
     | maxSalary | `No candidates under {$max/yr} match, so the salary cap was ignored.` |
     | minSalary | `No candidates over {$min/yr} match, so the salary minimum was ignored.` |
     | maxYears | `No candidates with at most {n} yrs match, so the experience cap was ignored.` |
     | minYears | `No candidates with {n}+ yrs match, so the experience minimum was ignored.` |
     | skills | `No candidates have {Skill} alongside the other requirements, so {Skill} was ignored.` |

   - If everything relaxable has been dropped and the set is still empty, return `total: 0` and `results: []`, with the relaxations that were tried.
   - `response.filters` is the effective filters after relaxation.
3. **Signals**, computed for the set only:
   - **Skill:** `Σ (roleCount + inBio)` over the effective `filters.skills`, as in S3. `skillNorm = score / max score in set`, or 0 when the max is 0. It's present only when `filters.skills` is non-empty.
   - **Keyword:** when `query.keywords` is non-empty, `keywordSearch(query.keywords.join(' '), { candidateIds: set, limit: set size })`. `keywordNorm = hit score / max hit score`; a candidate without a hit gets 0. It's present only when keywords are non-empty.
   - **Semantic:**
     1. `vector = await embedQuery(query.searchText)`
     2. `semanticSearch(vector, { limit: 100000 })` over **all** embedded candidates
     3. `percentile(c)` = the fraction of all embedded candidates whose similarity is ≤ c's. The best candidate gets 1.0.
     4. `semanticNorm = percentile`. A candidate with no embedding gets 0.

     It's present only when the embedding succeeds and at least one embedding exists. If `embedQuery` throws, the signal is absent and there's no error.
4. **Score** = `(0.55·semantic + 0.25·keyword + 0.20·skill) / (sum of the weights of the present signals)`, using only present signals. With no signals present, the score is 0.
   - **Order:** score from highest to lowest, then `yearsExperience` from highest to lowest, then id from lowest to highest. Take the top 10.
5. **`matchedSkills`:** the effective `filters.skills`.
6. **Reasons**, in this order:
   1. **skill** reasons (S3 wording), one per effective skill.
   2. **keyword**, when the candidate has a keyword hit:
      - label: `Resume mentions {terms}`, where terms are the distinct lowercased texts between `⟪ ⟫` in the snippet, in order of appearance, at most 4, joined with `, `
      - `snippet`: the hit's snippet, unchanged
   3. **semantic**, when present and percentile ≥ 0.9: `Top {k}% resume match for “{searchText}”`, with `k = max(1, ceil((1 − percentile) × 100))`. The quotes are curly.
   4. **experience**, **salary** and **country** (S3 wording), using the effective filters.
7. **Response:**
   - `query`: `queryText` trimmed, or `query.searchText` when `queryText` is absent
   - `interpretation`: `options.query`
   - `relaxed`, `filters`, `total` and `results` as above

## Test list (`tests/s5/*.test.ts`)
DB-backed. Skip the suite if `local.db` is missing. The semantic cases also skip if `candidate_embeddings` is empty. No test calls the network: always pass `embedQuery`.

Helpers the test may define:
- `q(overrides)` builds a `ParsedQuery`, defaults: `filters` all empty, `keywords` `[]`, `searchText` `'test'`, `seniority` `null`, `source` `'rules'`
- `reject = () => Promise.reject(new Error('offline'))`
- `vectorOf(id)` reads a stored vector with `vector_extract`

1. `searchCandidates(EMPTY)` with no options → `query` `null`, `interpretation` `null`, `relaxed` `[]`, `total` 1000. Years of experience are non-increasing.
2. `query: q({ keywords: ['rust'], searchText: 'rust' })`, `embedQuery: reject`:
   - Let `hits = keywordSearch('rust')` and `N = min(hits.length, 10)`. The first N result ids equal the first N hit ids, in the same order.
   - Each of those N results has a keyword reason whose label starts with `Resume mentions rust` and whose `snippet` contains `⟪`.
   - Results after the first N (score 0, filling up to 10) have no keyword reason.
   - No result has a semantic reason. `total` is 1000.
3. `query: q({ searchText: 'x' })`, `embedQuery` returning candidate X's stored vector (the first row of `candidate_embeddings`):
   - The first result is X, with `score` 1.
   - X has a reason `{ kind: 'semantic', label: 'Top 1% resume match for “x”' }`.
4. Filters countries `['Canada']`, `relaxable: ['countries']`, `query: q({})`, `embedQuery: reject` → `relaxed` equals `[{ field: 'countries', message: 'No candidates in Canada match, so country was ignored.' }]`, `filters.countries` `[]`, `total` 1000.
5. The same, but `relaxable: []` → `total` 0, `results` `[]`, `relaxed` `[]`.
6. Filters skills `['Rust', 'Elixir']`, `relaxable: ['skills']`, `query: q({})`, `embedQuery: reject`:
   - `relaxed` equals `[{ field: 'skills', message: 'No candidates have Elixir alongside the other requirements, so Elixir was ignored.' }]`
   - `filters.skills` is `['Rust']`
   - `total` equals the SQL count of Rust candidates
   - every result has `matchedSkills` `['Rust']`
7. Filters countries `['Canada']` and maxSalary `1000`, `relaxable: ['countries', 'maxSalary']`, `embedQuery: reject` → the `relaxed` fields are `['countries', 'maxSalary']` in that order. The second message is `No candidates under $1,000/yr match, so the salary cap was ignored.`
8. Filters skills `['Python']`, `query: q({ keywords: ['django'], searchText: 'python django' })`, `embedQuery` returning a stored vector:
   - For every result, the reason kinds follow the order skill → keyword → semantic → experience, allowing gaps.
   - Scores are non-increasing, there are at most 10 results, and `total` equals the SQL count of Python candidates.
9. `queryText: '  Senior React  '` → `response.query` is `'Senior React'`. `interpretation` is the given query object.
10. Every semantic reason label matches `/^Top \d+% resume match for “.+”$/`.

## Files owned
- **Implementation:** `src/lib/search/filter-search.ts`, plus new private helpers under `src/lib/search/` named `ranking*.ts` or `relax*.ts`.
- **Tests:** `tests/s5/*`.

## Done checklist
- [ ] tests written
- [ ] implementation passes, and the S3 tests still pass
- [ ] typecheck + lint clean; committed; PROGRESS.md updated

# Progress

## Now

- **Current slice:** Wave 3 is done. Natural-language search works end to end in the browser. 191/191 tests pass; typecheck and lint are clean.
- **Done after wave 3 (user decision):** domain skills (AI, ML, NLP, LLM, Blockchain) now rank instead of filter when another skill is present. "Rust … in AI/ML" returns 5 candidates, AI mentions first. 194/194 tests pass.
- **Done after wave 3 (user decision):** stack acronyms (MERN/MEAN/MEVN) expand to required skills; Express is a new canonical skill; the LLM's years/seniority are dropped unless the query mentions them. "MERN … india … under 2k per month" → Express, MongoDB, Node.js, React, India, ≤ $24k, 9 matches. 212/212 tests pass; 5,514 skill rows after reseed (Express 71, MongoDB 128).
- **S7 item 1 done (2026-09-20):**
  - Clean clone of `3b002bd` checked: `npm install` (22s), `db:seed` (8s, 1,000 embeddings), 212/212 tests, typecheck, lint and Prettier clean. `dev` serves every route.
  - The no-key path also works: the seed skips embeddings, and search uses the rules parser.
  - README rewritten; `AI_USAGE.md` drafted for the user to rewrite.
- **Next action (user):** rewrite `AI_USAGE.md` in your own words, export the sessions to `ai-sessions/`, push. Optional S7 items 2–5 are in Known issues.
- **Note:** a second session added the stack acronyms (MERN/MEAN/MEVN), the Express skill and an LLM field guard (`e4e8b27`…`3b002bd`), using the same workflow.

### Wave 3 agent schedule
| Round | Agents | Notes |
|---|---|---|
| A | tests: S4-back, S4-front, S5 | 3 parallel worktrees |
| B | impl: S4-back, S4-front, S5 | S4-back owns the route and codes against S5's `searchCandidates(filters, options)` signature |
| C | main: wire `q` into `page.tsx` + `search-app.tsx`; browser check with and without an API key | |

Contract changes (committed): `ParsedQuery`, `Relaxation`, `SearchResponse.query/interpretation/relaxed`, `MatchReason.snippet`, `mockNlSearchResponse`.

### Wave 2 agent schedule (done)

| Round | Agents                                                                                                   | Notes                                     |
| ----- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| A     | tests: S2, S3-back, S3-front, S6-back                                                                    | 4 parallel worktrees                      |
| B     | tests: S6-front; impl: S2, S3-back, S3-front                                                             | start each impl once its tests are merged |
| C     | impl: S6-back, S6-front                                                                                  |                                           |
| D     | main: wire `page.tsx` + `candidates/[id]/page.tsx`, merge the CandidateSummary helpers, check in browser |                                           |

Contract (main-owned, committed): `src/lib/contracts.ts`, `src/lib/format.ts`, `src/mocks/search.ts`, `src/mocks/profile.ts`.

## Status

| Slice | Status | Tests |
|---|---|---|
| S0 Foundation | done | — |
| S1 Derived data | done | 40/40 |
| S2 Search index | done (clean seed 27s, incl. 22s embedding) | 26/26 |
| S3 Filter search | done; checked in browser | 40/40 |
| S4 Natural-language search | done; checked in browser | 50/50 |
| S5 Ranking + explanations | done; checked live | 10/10 |
| S6 Profile page | done; checked in browser | 24/24 |
| S7 Submission polish | item 1 done (clean checkout, README, AI_USAGE draft) | 212/212 |

## Waves

1. S0 → S1 (sequential)
2. S2 ∥ S3 ∥ S6
3. S4 ∥ S5
4. S7

Slices with UI also split backend ∥ frontend. At most 4 agents at once.

## Blockers / open questions

- None.

## Known issues

- Agent worktrees are created from `origin/main`, not local `main`. Push before spawning, or have each agent fast-forward to local `main` first.
- Skill tagging false positives, accepted for now; the literal spec rules cause them. "Spring 2020" tags Spring, plain "node" tags Node.js, and a sentence-initial "Go ahead" tags Go.
- On mobile (375px) the filters fill the whole first screen, so the results start below the fold. S7 polish: collapse the filters behind a toggle on small screens.
- `src/lib/skill-spellings.ts` and the two page files (`page.tsx`, `candidates/[id]/page.tsx`) were written by the main session in round D and have no automated tests; they were checked in the browser. Candidates for a test agent in S7.
- "An older response never overwrites a newer one" (S3-front) has no automated test. The implementer verified it with a slow/fast fake fetch.
- The home page has no preloaded results: the server renders filters only and the client fetches on mount. A possible S7 improvement.
- Multi-word keywords are searched word by word ("machine learning" → `"machine" OR "learning"`), so a resume can match on "learning" alone. S7: quote multi-word keywords as FTS phrases.
- The parse cache key is lowercased, but case-sensitive terms (MERN/MEAN, JS, Go, AI) aren't. "MEAN dev" and "mean dev" share one cache entry, and whichever query runs first sets the result.
- Edit this file with the Edit tool, not string replacement in scripts. Replacements that didn't match once failed silently and left the status stale.

## Decision log

- 2026-09-19: FT rates of 0, under 500 or over 30000/mo → rate unknown, left out of salary filters. They're mostly INR or annual figures (84 of 92 high values are from India).
- 2026-09-19: A job with no end date means the person still works there. It ends at the next open-ended job's start, or today if it's the latest. Same-start open jobs all run to today. Overlaps are merged. 681 of 1,000 candidates have 2+ open jobs, mostly unclosed promotions.
- 2026-09-19: Internships and career breaks don't count toward years of experience.
- 2026-09-19: Skills come from a dictionary (for filters) plus embeddings (for the long tail), because there's no skills column.
- 2026-09-19: Embeddings are generated inside `db:seed` when a key is present, plus a standalone `db:embed`. This keeps the evaluator's clean-checkout path working.
- 2026-09-19: The only extra is the candidate profile page.
- 2026-09-19: Tests and code are written by separate agents; the implementer never sees the tests. This avoids code written only to pass tests.
- 2026-09-19: Test runner is vitest. Tests live in `tests/` (outside `src/`), so implementers can be told never to open that folder.
- 2026-09-19: Trainee, student, volunteer and teaching-assistant roles count as non-work (same treatment as internships). Freelance counts as work.
- 2026-09-19: `main` is pushed by the user. Sessions only commit locally and never push.
- 2026-09-19: S1 done. 204 rates unverified; years of experience median 6.7, max 41.7; 5,386 skill rows; Rust 7, Python 453.
- 2026-09-19: Keyword search uses SQLite FTS5 (bm25 + snippet); semantic search uses libsql's native `F32_BLOB` + `vector_distance_cos`. Both were checked locally. There's no vector index; 1,000 rows is fine to brute-force.
- 2026-09-19: Frontend tests use jsdom + Testing Library, opted into per file with `// @vitest-environment jsdom`. Components take injected data or fetchers, so they can be tested against mocks.
- 2026-09-19: Filters travel in the URL as repeated `country`/`skill` params plus `minYears`/`maxYears`/`minSalary`/`maxSalary` (annual USD). Salary filters exclude unverified rates.
- 2026-09-19: Explanations are structured `MatchReason { kind, label }`, so S5 can add keyword/semantic reasons without changing the UI.
- 2026-09-19: Round A test agents added clarifications to the specs; each spec has a "Clarifications" section. Implementers read the same text, so both sides build to the same rules.
- 2026-09-19: S2 done. The seed embeds up to 5 batches of 100 at once, which brought a clean seed from 89s to 27s. A `content_hash` cache means `db:embed` re-runs embed 0. Seeding without a key skips embeddings and exits 0.
- 2026-09-19: An existing pre-S2 `local.db` needs `npm run db:reset`. Seed stops early when candidates already exist, so the FTS table and embeddings stay empty until a reset. Evaluators start from a clean checkout, so this doesn't affect them.
- 2026-09-19: Round D. The S3 and S6 `CandidateSummary` mappings are merged into `src/lib/candidate-summary.ts`. The home page passes a fetcher through a small client wrapper (`search-app.tsx`), because a server component can't hand a function to a client component. An invalid shared URL falls back to no filters. The profile page returns 404 for bad or unknown ids.
- 2026-09-19: Profile highlighting expands skills to their plain spellings (React → ReactJS, React.js…), because resumes mostly say "ReactJS" and `highlightText` only matches whole words.
- 2026-09-19: Wave 3 design. The rule-based parser always works; the LLM parser (gpt-4o-mini, strict JSON schema, 6s timeout, cache of 200) is used when a key is present and falls back to rules on any error. Explicit filters beat parsed ones field by field. Only query-derived constraints can be relaxed, and only when nothing matches.
- 2026-09-19: Ranking with a query = 0.55 semantic + 0.25 keyword + 0.20 skill evidence, renormalized over the signals present. Semantic strength is a percentile over all 1,000 resumes, because raw cosine similarity isn't comparable across queries (top match ranged 0.41–0.55 in probes). Explanations are deterministic, with no LLM, so they're fast and can't hallucinate.
- 2026-09-19: Wave 3 done. The S4-back agent hit a usage limit partway through; resuming it with SendMessage kept its context and its test isolation. Live latency: 1.6–3.6s for a first-time query (LLM parse ~1.5s + embedding ~0.5s + DB <50ms); repeat queries skip the LLM via the parse cache.
- 2026-09-19: The query parser keeps the rules fallback's per-`CompleteFn` cache (the agent's reading), so tests with different fake models don't share cache entries.
- 2026-09-19: Domain skills (AI, Machine Learning, NLP, LLM, Blockchain) move from required skills to ranking keywords when the query names another skill; domain-only queries keep them required. Done in `normalizeParsed`, so the LLM and rule parsers agree.

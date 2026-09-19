# Progress

## Now

- **Current slice:** Wave 2 is done. Filter search and the profile page work end to end in the browser. 131/131 tests pass; typecheck and lint are clean.
- **Next action:** Wave 3 technical pass: write the S4 (natural-language search) and S5 (ranking + explanations) specs, plus the contract changes (`q` param, relaxation notice, keyword/semantic reasons). Then test agents.

### Wave 2 agent schedule (at most 4 at once)

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
| S4 Natural-language search | not started | |
| S5 Ranking + explanations | not started | |
| S6 Profile page | done; checked in browser | 24/24 |
| S7 Submission polish | not started | |

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

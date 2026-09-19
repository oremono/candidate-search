# Progress

## Now

- **Current slice:** Wave 2 (S2 ∥ S3 ∥ S6). Specs and contract are ready; no agents spawned yet.
- **Next action:** Spawn round A (test agents), with the user's go-ahead.

### Wave 2 agent schedule (at most 4 at once)

| Round | Agents                                                                                                   | Notes                                     |
| ----- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| A     | tests: S2, S3-back, S3-front, S6-back                                                                    | 4 parallel worktrees                      |
| B     | tests: S6-front; impl: S2, S3-back, S3-front                                                             | start each impl once its tests are merged |
| C     | impl: S6-back, S6-front                                                                                  |                                           |
| D     | main: wire `page.tsx` + `candidates/[id]/page.tsx`, merge the CandidateSummary helpers, check in browser |                                           |

Contract (main-owned, committed): `src/lib/contracts.ts`, `src/lib/format.ts`, `src/mocks/search.ts`, `src/mocks/profile.ts`.

## Status

| Slice                                                      | Status      | Branch |
| ---------------------------------------------------------- | ----------- | ------ |
| S0 Foundation: test runner, CLAUDE.md, progress file       | done        | main   |
| S1 Derived data: years of experience, rate cleanup, skills | spec ready  |        |
| S2 Search index: keyword + embeddings                      | not started |        |
| S3 Filter search: API + filter panel                       | not started |        |
| S4 Natural-language search: parsing + search bar           | not started |        |
| S5 Ranking + explanations                                  | not started |        |
| S6 Candidate profile page                                  | not started |        |
| S7 Submission polish                                       | not started |        |

## Waves

1. S0 → S1 (sequential)
2. S2 ∥ S3 ∥ S6
3. S4 ∥ S5
4. S7

Slices with UI also split backend ∥ frontend. At most 4 agents at once.

## Blockers / open questions

- None.

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

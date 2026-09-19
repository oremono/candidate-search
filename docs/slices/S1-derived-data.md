# S1: Derived data

Status: done

## Goal

Compute three things per candidate at seed time: **years of experience**, a **usable monthly rate**, and **skills**. Filters and ranking (S3/S5) and the profile page (S6) read them. The logic lives in pure functions so it can be tested without a database.

## Rules for agents

- **Test agent**: write tests only under `tests/s1/`, from this spec alone. Don't open `src/lib/derive/`.
- **Implementation agent**: never open or edit anything under `tests/`. Build from this spec alone.
- Both: don't change the signatures in "API contract". Ask the main session if one seems wrong.

## API contract (`src/lib/derive/`)

```ts
// experience.ts
export interface JobInput {
  company: string;
  position: string;
  startDate: Date | null;
  endDate: Date | null;
}
export interface ResolvedJob extends JobInput {
  /** true if the job counts toward years of experience */
  counted: boolean;
  /** why it was not counted; null when counted */
  excludedReason: 'intern' | 'non-work' | 'no-start-date' | null;
  /** end date after applying the open-ended rules; null when not counted */
  effectiveEndDate: Date | null;
}
/** Same order as the input. */
export function resolveJobs(jobs: JobInput[], today: Date): ResolvedJob[];
/** Years with overlaps merged, rounded to 1 decimal. */
export function yearsOfExperience(jobs: JobInput[], today: Date): number;

// rate.ts
export interface NormalizedRate {
  monthlyRate: number | null;
  rateUnverified: boolean;
}
export function normalizeMonthlyRate(raw: number | null): NormalizedRate;

// skills.ts
export const SKILLS: readonly string[]; // canonical names, listed below
export function extractSkills(text: string): string[]; // canonical names, deduplicated, default JS sort()
```

## Rules

### Years of experience

1. **Excluded: interns.** Position or company matches the whole word `intern`, `interns` or `internship`, case-insensitive. "International" does not match. → `excludedReason: 'intern'`.
2. **Excluded: non-work.** Position or company contains `career break`, `career transition`, `career gap`, `sabbatical`, `trainee`, `student`, `volunteer` or `teaching assistant`, case-insensitive. → `'non-work'`. Freelance **does** count.
3. **Excluded: no start date.** → `'no-start-date'`. If a job matches more than one rule, use the first matching rule in this list.
4. **Has an end date:** the effective end is that end date, capped at `today`.
5. **No end date:** among the _other counted_ jobs with no end date, find the earliest start date that is strictly later than this job's start. That date is the effective end. If there isn't one, the effective end is `today`.
6. **Same start dates:** open-ended jobs with the same start date don't end each other. Each one ends at the next strictly later open-ended start, or at `today`.
7. **Total:** merge overlapping or touching `[start, effectiveEnd]` periods, add up the days, divide by 365.25, and round to 1 decimal. No counted jobs → `0`.
8. All date maths is in UTC days.

### Rate

- `null`, `0`, anything below `500`, or anything above `30000` → `{ monthlyRate: null, rateUnverified: true }`.
- Anything from `500` to `30000` inclusive → `{ monthlyRate: raw, rateUnverified: false }`.
- Applied to the full-time rate and the part-time rate separately.

### Skills

Canonical list: JavaScript, TypeScript, Python, Java, Kotlin, Swift, Go, Rust, C++, C#, .NET, Ruby, Ruby on Rails, PHP, Scala, Elixir, React, React Native, Angular, Vue, Next.js, Node.js, Django, Flask, FastAPI, Spring, AWS, GCP, Azure, Docker, Kubernetes, Terraform, SQL, PostgreSQL, MySQL, MongoDB, Redis, GraphQL, Machine Learning, AI, NLP, LLM, PyTorch, TensorFlow, Spark, Flutter, Android, iOS, Solidity, Blockchain.

Matching is case-insensitive unless a rule below says otherwise. A match must not be glued to a neighbouring letter or digit: "javascript" does not contain Java, and "rusty" does not contain Rust.

| Input contains                                                      | Tags                     | Must NOT tag                                        |
| ------------------------------------------------------------------- | ------------------------ | --------------------------------------------------- |
| `javascript`, `JS` (case-sensitive)                                 | JavaScript               | Java                                                |
| `typescript`, `TS` (case-sensitive)                                 | TypeScript               |                                                     |
| `react native`                                                      | React Native             | React (unless plain "react" also appears elsewhere) |
| `react`, `react.js`, `reactjs`                                      | React                    |                                                     |
| `node`, `node.js`, `nodejs`                                         | Node.js                  |                                                     |
| `next.js`, `nextjs`                                                 | Next.js                  |                                                     |
| `golang`, or `Go` (case-sensitive, standalone, not followed by `-`) | Go                       | "go-to", "to go" (lowercase)                        |
| `c++`, `cpp`                                                        | C++                      | C#                                                  |
| `c#`, `csharp`                                                      | C#                       | C++                                                 |
| `.net`, `dotnet`, `asp.net`                                         | .NET                     |                                                     |
| `rails`, `ruby on rails`                                            | Ruby on Rails (and Ruby) |                                                     |
| `postgres`, `postgresql`                                            | PostgreSQL (and SQL)     |                                                     |
| `mysql`                                                             | MySQL (and SQL)          |                                                     |
| `sql`                                                               | SQL                      |                                                     |
| `machine learning`, `ML` (case-sensitive)                           | Machine Learning         | from "html" or "xml"                                |
| `AI` (case-sensitive), `artificial intelligence`                    | AI                       | from "said", "email"                                |
| `NLP`, `natural language processing`                                | NLP                      |                                                     |
| `LLM`, `LLMs`, `large language model`                               | LLM                      |                                                     |
| `aws`, `amazon web services`                                        | AWS                      |                                                     |
| `gcp`, `google cloud`                                               | GCP                      |                                                     |
| `k8s`, `kubernetes`                                                 | Kubernetes               |                                                     |
| `ios`                                                               | iOS                      | from "bios", "scenarios"                            |
| any other canonical name                                            | that name                |                                                     |

## Clarifications (added after the test pass)

- `resolveJobs` returns each input job's fields unchanged, plus `counted`, `excludedReason` and `effectiveEndDate`. Excluded jobs have `effectiveEndDate: null`. `resolveJobs([])` returns `[]`.
- Excluded jobs contribute nothing to `yearsOfExperience` and never end another open-ended job.
- `normalizeMonthlyRate` returns an object with exactly two fields, `monthlyRate` and `rateUnverified`, and nothing else.
- `SKILLS` holds exactly the 50 canonical names listed above, with no duplicates.
- In SQLite, booleans are stored as the integers 0 and 1. SQL column names are snake_case: `years_experience`, `rate_unverified`, and the `candidate_skills` columns.

## Seed integration

- New columns on `candidates`:
  - `yearsExperience` (real, not null, default 0)
  - `fullTimeRateNormalized` and `partTimeRateNormalized` (int, nullable)
  - `rateUnverified` (bool, taken from the full-time rate)
- New table `candidate_skills(candidateId, skill, inBio bool, roleCount int)`, primary key `(candidateId, skill)`, index on `skill`:
  - `inBio`: whether the skill was found in the biography.
  - `roleCount`: how many experiences mention it, in position or description.
- `db:seed` / `db:reset` runs a "Deriving" step after the inserts, with `today = new Date()`.

## Test list (input → expected)

Use `today = 2026-09-19` (UTC) in tests. A bare year like `2018` means `2018-01-01` UTC. "Sorted A→Z" means the default JS `Array.prototype.sort()` (code-unit order).

**yearsOfExperience / resolveJobs**

1. No jobs → 0.
2. One job 2020-01-01 → 2022-01-01 → 2.0.
3. One open job starting 2024-09-19 → 2.0.
4. Overlap: 2018–2022 and 2020–2024 → 6.0 (not 8).
5. Touching: 2018–2020 and 2020–2022 → 4.0.
6. Two open jobs starting 2019-01-01 and 2022-01-01 → the first's `effectiveEndDate` is 2022-01-01; the second's is today; total ≈ 7.7.
7. Two open jobs, both starting 2023-01-01 → both effective ends are today.
8. Open 2020-01-01 and closed 2021–2023: the closed job does **not** end the open one → effective end is today.
9. "Software Engineer Intern" 2015–2019 plus "Engineer" 2019–2021 → 2.0; the intern job has `counted: false`, reason `'intern'`.
10. Company "Career Break", position "Travel" → `'non-work'`.
11. Position "International Sales Engineer" → counted.
12. `startDate: null` → `'no-start-date'`, not counted.
13. End date after today → capped at today.
14. Output order matches input order.

**normalizeMonthlyRate**

15. `null`, `0`, `1`, `499`, `30001`, `17065389` → `{ null, true }`.
16. `500`, `5000`, `30000` → the same value, `false`.

**extractSkills**

17. "Experienced in JavaScript and Java" → `['Java', 'JavaScript']`.
18. "React Native apps" → `['React Native']`.
19. "React and React Native" → `['React', 'React Native']`.
20. "my go-to tool, let's go" → `[]`.
21. "Backend in Go and Golang" → `['Go']`.
22. "C++, C# and .NET" → `['.NET', 'C#', 'C++']`.
23. "HTML and XML parsing" → `[]`.
24. "Built ML pipelines with PyTorch" → `['Machine Learning', 'PyTorch']`.
25. "She said the email was sent" → `[]`.
26. "Postgres expert" → `['PostgreSQL', 'SQL']`.
27. "Worked on BIOS firmware scenarios" → `[]`.
28. "iOS and Android" → `['Android', 'iOS']`.
29. Empty string → `[]`.

**Seed smoke test** (`tests/s1/seed.test.ts`, run against `local.db` after `npm run db:reset`; skip if the db is missing)

30. 1,000 candidates; none has negative `yearsExperience`.
31. Exactly 204 candidates have `rateUnverified = true`.
32. `candidate_skills` has at least one Python row and at least one Rust row, and no skill outside `SKILLS`.

## Files owned

- Implementation: `src/lib/derive/*`, `src/db/schema.ts` (new columns and table), `src/db/seed.ts` (derive step), new migration.
- Tests: `tests/s1/*`.

## Done checklist

- [x] tests written (test agent)
- [x] implementation passes
- [x] `npm run db:reset` works; typecheck + lint clean
- [x] committed + PROGRESS.md updated

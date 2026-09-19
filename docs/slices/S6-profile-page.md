# S6: Candidate profile page

Status: spec ready. Split into **S6-back** and **S6-front**, which run in parallel against `src/lib/contracts.ts` and `src/mocks/profile.ts`.

## Goal

`/candidates/[id]` shows everything a recruiter needs to judge a match:

- summary, rates and availability
- bio
- an experience timeline that shows which jobs count toward years of experience and why others don't
- education
- skills with the evidence behind each one

Skills passed as `?highlight=React,Rust` from a search result are highlighted in the text.

## Rules for agents

- **Test agents** write only under `tests/s6/` and never open implementation files.
- **Implementation agents** never open, list or run anything under `tests/`, and never run `npm test` or `vitest`.
- Nobody changes `src/lib/contracts.ts`, `src/mocks/*`, `src/lib/format.ts` or this spec.
- The page file `src/app/candidates/[id]/page.tsx` is wired up by the main session after both halves merge.

---

## S6-back

### API contract

```ts
// src/lib/profile.ts
export function getCandidateProfile(id: number): Promise<CandidateProfile | null>;

// src/app/api/candidates/[id]/route.ts
// GET(request, { params }: { params: Promise<{ id: string }> })
//   → 200 CandidateProfile | 400 ApiError | 404 ApiError
```

### Rules

- **`candidate`:** built with the same `CandidateSummary` rules as S3:
  - name = first + last
  - `monthlyRate` = `full_time_rate_normalized`
  - `topSkills` = up to 8, ordered by `roleCount + inBio` from highest to lowest, then by name using the default JS sort
- **`partTimeMonthlyRate`:** `part_time_rate_normalized`.
- **`experiences`:**
  - Pass every experience through S1's `resolveJobs(jobs, new Date())` from `src/lib/derive/experience.ts`, so `counted`, `excludedReason` and `effectiveEndDate` match what years of experience used.
  - Dates are ISO `YYYY-MM-DD` in UTC; null stays null. `description` null → `''`.
  - Order: start date from newest to oldest, jobs with no start date last. Ties keep database id order.
- **`education`:** dates as ISO; the same ordering as experiences. `degree` is trimmed.
- **`skills`:** every `candidate_skills` row, ordered by `roleCount + inBio` from highest to lowest, then by name.
- An unknown id → `null`.
- **Route:**
  - `id` must match `/^[1-9]\d*$/`, otherwise 400 `{ error: 'Invalid candidate id' }`.
  - No profile → 404 `{ error: 'Candidate not found' }`.

### Clarifications (added after the test pass)
- Each `skills` entry has exactly the fields `{ name, inBio, roleCount }`.
- Database timestamps are unix seconds. The ISO date is the UTC `YYYY-MM-DD` of that instant.
- Both 400 cases return `{ error: 'Invalid candidate id' }`.

### Test list: S6-back (`tests/s6/back/*.test.ts`; skip if `local.db` is missing; find real ids with SQL)

1. Pick the candidate with the most experiences, using SQL:
   - The number of experiences equals that SQL count.
   - `candidate.yearsExperience` equals `years_experience`.
2. Experiences are ordered by start date from newest to oldest, with null starts last.
3. Every counted experience has a non-null `effectiveEndDate`. Every non-counted one has `effectiveEndDate` null and a non-null `excludedReason`.
4. Pick a candidate with at least one `intern` job (found with SQL: position like `%Intern%`). That job has `counted: false`, `excludedReason: 'intern'`.
5. All dates match `/^\d{4}-\d{2}-\d{2}$/` or are null.
6. Skills equal that candidate's `candidate_skills` rows, ordered as specified, and `topSkills` is the first 8 names.
7. `getCandidateProfile(99999999)` → `null`.
8. The route with id `'abc'` → 400. With `'0'` → 400. With `'99999999'` → 404 `{ error: 'Candidate not found' }`. With a real id → 200, and the body's `candidate.id` matches.

---

## S6-front

### Component contract

```ts
// src/lib/highlight.ts
export interface TextSegment {
  text: string;
  match: boolean;
}
export function highlightText(text: string, terms: string[]): TextSegment[];

// src/components/profile/profile-view.tsx (client-safe; no data fetching)
export function ProfileView(props: {
  profile: CandidateProfile;
  highlight: string[];
}): React.ReactElement;
```

### highlightText

- Case-insensitive.
- A match must not be glued to a neighbouring letter or digit.
- Terms may contain regex characters such as `C++`, `C#` or `.NET`, so escape them.
- When terms overlap, the longest term wins: `React Native` beats `React`.
- Empty or blank terms are ignored.
- Joining all segment texts together returns exactly the original text.
- Adjacent non-matching text is merged into one segment. There are no empty segments, except that `''` input returns `[]`.

### ProfileView

- **Header:**
  - an `h1` with the name
  - country and `formatYears(yearsExperience)`
  - the full-time rate via `formatMonthlyRate`, labelled `Full-time`
  - the part-time rate via `formatMonthlyRate`, labelled `Part-time`
  - availability tags from the true flags only: `Full-time`, `Part-time`, `Contractor`, `Employee`
- A **Back to search** link to `/`.
- **About:** the bio, with highlighted terms rendered in `<mark>`.
- **Experience** (an `h2`): one `li` per experience, showing:
  - the position and company
  - `formatDateRange(startDate, endDate)`
  - the description, with highlighted terms in `<mark>`
  - when not counted, a badge: `Not counted: internship`, `Not counted: non-work` or `Not counted: no start date`
- **Education** (an `h2`): one `li` per entry with degree, school and `formatDateRange`. A blank degree shows the school only.
- **Skills** (an `h2`): one chip per skill with the text `{name} · {n} role(s)` plus ` · bio` when it's in the bio, e.g. `React · 3 roles · bio` or `Go · 1 role`. Chips whose name is in `highlight` (case-insensitive) are wrapped in `<mark>`.
- A section with no items shows `None listed`.
- Style with Tailwind, clean and readable, and working at 375px width.

### Test list: S6-front (`tests/s6/front/*.test.tsx`, first line `// @vitest-environment jsdom`)

**highlightText**

9. `('I love react and React Native', ['React', 'React Native'])` → segments `'I love '` / `'react'`✓ / `' and '` / `'React Native'`✓.
10. `('Built C++ and C# tools', ['C++', 'C#'])` → both are matched.
11. `('reactive systems', ['React'])` → a single non-match segment.
12. `('abc', [])` → `[{ text: 'abc', match: false }]`. `('', ['x'])` → `[]`.
13. For any input, joining the segment texts gives back the input. Check at least 3 inputs.

**ProfileView** (`mockProfile`)

14. The `h1` is **Ana Souza**. The page shows `7.4 yrs`, `$6,000/mo` next to `Full-time`, and `$3,000/mo` next to `Part-time`.
15. The Experience list has 3 items. The intern item shows `Not counted: internship`, and the others show no "Not counted" badge.
16. The first experience shows `Mar 2022 – Present`.
17. With `highlight={['React']}`: the About text has a `mark` containing `React`, and the React skill chip is inside a `mark`.
18. With `highlight={[]}`: there are no `mark` elements.
19. Skill chips read `React · 3 roles · bio`, `TypeScript · 1 role · bio` and `Node.js · 1 role`.
20. A profile with `education: []` shows `None listed` under Education.
21. The **Back to search** link has `href` `/`.

## Files owned

- **S6-back:** `src/lib/profile.ts`, `src/app/api/candidates/[id]/route.ts`, `tests/s6/back/*` (test agent).
- **S6-front:** `src/lib/highlight.ts`, `src/components/profile/*`, `tests/s6/front/*` (test agent).
- **Main, after merge:** `src/app/candidates/[id]/page.tsx`. It's a server component that calls `getCandidateProfile`, uses `notFound()` for null, reads `?highlight` split on commas, and renders `ProfileView`. The main session then checks it in the running app.

## Note on shared code

S3-back and S6-back both need the `CandidateSummary` mapping. To avoid a merge conflict, S6-back writes its own private helper in `src/lib/profile.ts`. The main session merges the two into one shared helper after wave 2 (a refactor, with tests already covering both).

## Done checklist

- [ ] back: tests written
- [ ] back: implementation passes
- [ ] front: tests written
- [ ] front: implementation passes
- [ ] page wired; checked in the running app
- [ ] typecheck + lint clean; committed; PROGRESS.md updated

# S3: Filter search (API + filter panel)

Status: spec ready. Split into **S3-back** and **S3-front**, which run in parallel against `src/lib/contracts.ts` and the mocks in `src/mocks/search.ts`.

## Goal

A recruiter picks countries, skills, a years-of-experience range and an annual salary range, and gets the top 10 candidates, each with short reasons. There's no free-text query yet (that's S4) and ranking is basic (S5 improves it).

## Rules for agents

- **Test agents** write only under `tests/s3/` and never open implementation files.
- **Implementation agents** never open, list or run anything under `tests/`, and never run `npm test` or `vitest`.
- Nobody changes `src/lib/contracts.ts`, `src/mocks/*`, `src/lib/format.ts` or this spec.
- `src/app/page.tsx` is wired up by the main session after both halves merge. Neither agent touches it.

## Shared: query-string format

Filters in the URL use these parameter names:

| Param                    | Meaning                         |
| ------------------------ | ------------------------------- |
| `country`                | repeated, one value per country |
| `skill`                  | repeated, one value per skill   |
| `minYears`, `maxYears`   | experience range                |
| `minSalary`, `maxSalary` | annual USD                      |

Empty or absent means "no constraint". Example: `?country=Brazil&skill=React&skill=Python&minYears=5&maxSalary=120000`.

---

## S3-back

### API contract

```ts
// src/lib/search/params.ts
export type ParseResult = { ok: true; filters: SearchFilters } | { ok: false; error: string };
export function parseSearchParams(params: URLSearchParams): ParseResult;

// src/lib/search/filter-search.ts
export function searchCandidates(filters: SearchFilters): Promise<SearchResponse>;
export function getFilterOptions(): Promise<FilterOptions>;

// src/app/api/candidates/search/route.ts: GET → 200 SearchResponse | 400 ApiError
// src/app/api/candidates/filters/route.ts: GET → 200 FilterOptions
```

The types come from `src/lib/contracts.ts`.

### parseSearchParams

- **country:** trimmed, empties dropped, deduplicated case-insensitively, keeping the first spelling.
- **skill:** matched case-insensitively against `SKILLS` from `src/lib/derive/skills.ts` and returned in canonical form (`react` → `React`). An unknown skill → `{ ok: false, error: 'Unknown skill: Cobol' }`.
- **Numbers:** must be finite and ≥ 0. Anything else → `{ ok: false, error: 'Invalid minYears' }`, using the parameter's name. An empty string means null.
- `minYears > maxYears` → `'minYears is greater than maxYears'`. The same rule applies to salary, with `'minSalary is greater than maxSalary'`.

### searchCandidates

- **Filtering**, all conditions combined with AND:
  - **Country:** case-insensitive exact match on any of the listed countries.
  - **Skills:** the candidate has a `candidate_skills` row for every requested skill.
  - **Years:** `years_experience` between the min and max, inclusive.
  - **Salary:** if either bound is set, `rate_unverified = 0` and `full_time_rate_normalized × 12` falls between the bounds, inclusive.
- **Score:** for each requested skill, add `roleCount + (inBio ? 1 : 0)`. With no skills requested, the score is 0.
- **Order:** score from highest to lowest, then years of experience from highest to lowest, then id from lowest to highest. Take the top 10.
- **`total`:** the number of candidates that match, before the top 10 are taken.
- **`filters`:** the filters as given.
- **`matchedSkills`:** the requested skills, in request order.
- **`CandidateSummary`:**
  - `name`: `firstName + ' ' + lastName`.
  - `monthlyRate`: `full_time_rate_normalized`.
  - `topSkills`: up to 8 skills, ordered by `roleCount + inBio` from highest to lowest, then by name using the default JS sort.
- **Reasons**, in this order:
  1. One `skill` reason per matched skill:
     - `"{Skill} in {n} roles and bio"`
     - `"{Skill} in {n} roles"`
     - `"{Skill} in bio"`
     - Use "1 role", not "1 roles".
  2. Always one `experience` reason: `"{y} yrs experience"`. Add `" (min {a})"`, `" (max {b})"` or `" ({a}–{b})"` when a min or max filter is set.
  3. One `salary` reason, only when a salary filter is set: `"${annual}/yr"` with commas (e.g. `$72,000/yr`), followed by `", under ${max}"`, `", over ${min}"` or `", within ${min}–${max}"`.
  4. One `country` reason, only when a country filter is set: `"Based in {country}"`.

### getFilterOptions

- **countries:** every distinct country except `-`, with a count, ordered by count from highest to lowest, then by name.
- **skills:** every skill that has at least one candidate, with its candidate count, ordered the same way.

### Route handlers

- **search route:** parses with `parseSearchParams`. Invalid input → 400 `{ error }`. Otherwise → 200 with the `searchCandidates` result.
- **filters route:** → 200 with the `getFilterOptions()` result.
- The old stub's `q` parameter is ignored for now (S4 adds it).

### Test list: S3-back (`tests/s3/back/*.test.ts`; DB tests skip if `local.db` is missing)

**parseSearchParams**

1. `''` → ok, with every filter empty or null.
2. `country=Brazil&country=brazil&country=%20India%20` → countries `['Brazil', 'India']`.
3. `skill=react&skill=PYTHON` → `['React', 'Python']`.
4. `skill=Cobol` → error `'Unknown skill: Cobol'`.
5. `minYears=abc` → `'Invalid minYears'`. `maxSalary=-1` → `'Invalid maxSalary'`.
6. `minYears=10&maxYears=5` → `'minYears is greater than maxYears'`.
7. `minYears=&maxSalary=120000` → minYears `null`, maxSalary `120000`.

**searchCandidates / getFilterOptions**

8. No filters → `total` 1000 and 10 results. Years of experience are non-increasing, since every score is 0.
9. countries `['canada']` → total 0, results `[]`.
10. countries `['india']` → total 675, and every result's country is `India`.
11. skills `['Rust']` → `total` equals the number of Rust rows in `candidate_skills`, read with SQL. Every result has `matchedSkills` `['Rust']` and a skill reason that starts with `Rust in`.
12. skills `['Rust', 'Python']` → every result has `matchedSkills` `['Rust', 'Python']` and one skill reason for each. `total` is ≤ the Rust-only total.
13. minYears 10 → every result has `yearsExperience ≥ 10`, and one reason is exactly `"{y} yrs experience (min 10)"`.
14. maxSalary 60000 → every result has `rateUnverified` false and `monthlyRate ≤ 5000`, and has a salary reason ending in `under $60,000`.
15. Scores are non-increasing, and `results.length ≤ 10` and `≤ total`.
16. `getFilterOptions()`: countries include `{ name: 'India', count: 675 }` first, `-` is absent, and every skill name is in `SKILLS`.

**Route handlers** (import `GET` and call it with a `Request`)

17. `/api/candidates/search?skill=react` → 200, `filters.skills` is `['React']`.
18. `/api/candidates/search?skill=Cobol` → 400 `{ error: 'Unknown skill: Cobol' }`.
19. `/api/candidates/filters` → 200 with non-empty `countries` and `skills`.

---

## S3-front

### Component contract (client components under `src/components/search/`)

```ts
// src/lib/search-query.ts
export const EMPTY_FILTERS: SearchFilters;
export function buildSearchQuery(filters: SearchFilters): string; // no leading '?'

// filter-panel.tsx
export function FilterPanel(props: {
  options: FilterOptions;
  value: SearchFilters;
  onChange: (next: SearchFilters) => void;
}): React.ReactElement;

// result-card.tsx
export function ResultCard(props: { result: SearchResult }): React.ReactElement;

// search-page.tsx
export function SearchPage(props: {
  options: FilterOptions;
  initialFilters: SearchFilters;
  fetchResults: (filters: SearchFilters) => Promise<SearchResponse>;
}): React.ReactElement;
```

Use `formatMonthlyRate` and `formatYears` from `src/lib/format.ts`. Style with Tailwind, matching the theme tokens in `globals.css`. It should look clean and calm, and work at 375px width.

### buildSearchQuery

- Parameter order: `country` values, then `skill` values, then `minYears`, `maxYears`, `minSalary`, `maxSalary`.
- Null values and empty arrays are left out.
- Values are URL-encoded with `URLSearchParams`.

### FilterPanel

- A `fieldset` whose legend is **Country**, with one checkbox per option. The checkbox's accessible name is exactly the country name. The count is shown next to it, hidden from assistive tech with `aria-hidden`.
- A `fieldset` whose legend is **Skills**, built the same way. Above it is a text input labelled **Filter skills** that hides non-matching skill checkboxes (case-insensitive substring). Checked skills always stay visible.
- Number inputs labelled **Min years**, **Max years**, **Min salary (USD/yr)** and **Max salary (USD/yr)**. An empty input means `null`.
- A **Clear filters** button that calls `onChange(EMPTY_FILTERS)`.
- Every change calls `onChange` right away with the full next `SearchFilters`. Checking adds the value at the end of the list; unchecking removes it.

### ResultCard

- The name is a link to `/candidates/{id}`. When there are matched skills, add `?highlight=` followed by the matched skills, comma-joined and URL-encoded.
- Shows the country, `formatYears(yearsExperience)`, and `formatMonthlyRate(monthlyRate)`. An unverified rate shows the text **Rate unverified**.
- `topSkills` appear as chips. Matched skills are rendered inside a `<mark>`.
- Reasons appear in a list with `aria-label="Why matched"`, one `li` per reason, whose text is the reason's label.

### SearchPage

- Renders `FilterPanel` and the results.
- **Fetching:** calls `fetchResults(initialFilters)` on mount. After any filter change, it waits 300 ms of no further changes, then calls `fetchResults(latest)`. A response to an older request never overwrites a newer one.
- **URL:** after each change, calls `window.history.replaceState(null, '', '?' + buildSearchQuery(filters))`. Use `'?'` alone when the query is empty.
- **While fetching:** shows an element with `role="status"` and the text `Searching…`.
- **On error:** shows `role="alert"` with the error's message.
- **With results:** shows the text `{total} candidates match · showing top {results.length}`, then a `ResultCard` per result.
- **With `total` 0:** shows `No candidates match these filters.` and a **Clear filters** button.

### Test list: S3-front (`tests/s3/front/*.test.tsx`, first line `// @vitest-environment jsdom`; use `@testing-library/user-event` and `vi.useFakeTimers({ shouldAdvanceTime: true })` for debounce)

**format.ts** (already implemented; the tests pin its behaviour)

20. `formatMonthlyRate(5000)` → `'$5,000/mo'`. `formatMonthlyRate(null)` → `'Rate unverified'`.
21. `formatYears(6.7)` → `'6.7 yrs'`. `formatYears(1)` → `'1 yr'`. `formatYears(0)` → `'0 yrs'`.
22. `formatDateRange('2020-01-01', null)` → `'Jan 2020 – Present'`. `formatDateRange(null, '2021-06-30')` → `'Unknown start – Jun 2021'`.

**buildSearchQuery**

23. `EMPTY_FILTERS` → `''`.
24. `mockSearchResponse.filters` → `'country=Brazil&skill=React&minYears=5&maxSalary=120000'`.
25. countries `['Costa Rica']`, skills `['C++', 'C#']` → `'country=Costa+Rica&skill=C%2B%2B&skill=C%23'`.

**FilterPanel** (using `mockFilterOptions`)

26. Checking **Brazil** calls `onChange` with countries `['Brazil']`, other fields unchanged.
27. With value countries `['Brazil']`, unchecking **Brazil** calls `onChange` with countries `[]`.
28. Typing `ru` in **Filter skills** leaves **Rust** visible and hides **Python** and **React**.
29. Typing `5` in **Min years** calls `onChange` with `minYears: 5`. Clearing it calls `onChange` with `null`. 30. **Clear filters** calls `onChange` with `EMPTY_FILTERS`.

**ResultCard**

31. `mockSearchResponse.results[0]`: the link to `/candidates/101?highlight=React` has the text **Ana Souza**, and the card shows `7.4 yrs`, `$6,000/mo`, and 4 items in the **Why matched** list.
32. `results[1]` shows **Rate unverified**.
33. The **React** chip is inside a `mark`, and **TypeScript** is not.

**SearchPage** (`fetchResults` as a `vi.fn`)

34. On mount it calls `fetchResults` once with `initialFilters`, then shows `23 candidates match · showing top 2` and both names.
35. Two quick filter changes within 300 ms → only one additional call, made with the latest filters.
36. After a change, `window.location.search` equals `'?' + buildSearchQuery(latest)`.
37. `fetchResults` returns `mockEmptySearchResponse` → shows `No candidates match these filters.`.
38. `fetchResults` rejects with `new Error('boom')` → the `role="alert"` element contains `boom`.
39. `Searching…` is shown while a request is still pending.

## Files owned

- **S3-back:**
  - `src/lib/search/params.ts`, `src/lib/search/filter-search.ts`
  - `src/app/api/candidates/search/route.ts`, `src/app/api/candidates/filters/route.ts`
  - `tests/s3/back/*` (test agent)
- **S3-front:**
  - `src/lib/search-query.ts`, `src/components/search/*`
  - `tests/s3/front/*` (test agent)
- **Main, after merge:** `src/app/page.tsx` wiring. It reads the search params, parses them into `initialFilters`, loads options with `getFilterOptions()`, and calls `fetch('/api/candidates/search?' + buildSearchQuery(f))`. After that, the main session checks in the running app.

## Done checklist

- [ ] back: tests written
- [ ] back: implementation passes
- [ ] front: tests written
- [ ] front: implementation passes
- [ ] page wired; checked in the running app
- [ ] typecheck + lint clean; committed; PROGRESS.md updated

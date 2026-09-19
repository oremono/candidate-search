# S4: Natural-language search (query parsing + search bar)

Status: spec ready. Split into **S4-back** (parser + route) and **S4-front** (search bar, interpretation, relaxation notice, snippets). They run in parallel with S5-back against `src/lib/contracts.ts` and `src/mocks/search.ts`.

## Goal
A recruiter types something like "Senior React engineer in Canada under 130k". The app:
- turns the query into structured filters (skills, countries, years, salary) plus leftover keywords
- shows how it read the query
- ranks candidates with those filters plus a resume match (S5)

It works without an OpenAI key (rule-based parser) and gets better with one (LLM parser).

## Rules for agents
- **Test agents** write only under `tests/s4/` and never open implementation files.
- **Implementation agents** never open, list or run anything under `tests/`, and never run `npm test` or `vitest`.
- Nobody changes `src/lib/contracts.ts`, `src/mocks/*`, `src/lib/format.ts` or this spec.
- `src/app/page.tsx` and `src/components/search/search-app.tsx` are wired up by the main session after merge.

---

## S4-back

### API contract

```ts
// src/lib/search/countries.ts
/** Canonical country for a name or alias ("usa" → "United States"), or null. */
export function canonicalCountry(name: string): string | null;
/** Canonical countries mentioned in free text, in order of first mention, deduplicated. */
export function findCountries(text: string): string[];

// src/lib/search/rules-parser.ts
export function parseQueryWithRules(q: string): ParsedQuery; // source: 'rules'

// src/lib/search/query-parser.ts
export interface RawParsedQuery {
  skills: string[];
  countries: string[];
  minYears: number | null;
  maxYears: number | null;
  minSalary: number | null; // annual USD
  maxSalary: number | null;
  seniority: Seniority | null;
  keywords: string[];
  searchText: string;
}
/** Returns the model's JSON text for the query. Injectable for tests. */
export type CompleteFn = (q: string) => Promise<string>;
export function normalizeParsed(raw: RawParsedQuery, source: 'llm' | 'rules'): ParsedQuery;
export function parseQuery(q: string, options?: { complete?: CompleteFn }): Promise<ParsedQuery | null>;

// src/lib/search/merge.ts
/** Explicit filters win field by field; returns merged filters and the fields that came from the query. */
export function mergeFilters(
  explicit: SearchFilters,
  parsed: SearchFilters
): { filters: SearchFilters; fromQuery: (keyof SearchFilters)[] };

// src/lib/search/params.ts (add, don't change parseSearchParams)
export function parseQueryParam(params: URLSearchParams): string; // trimmed `q`, '' when absent
```

### Rules

#### Countries (`countries.ts`)
- **Known countries:** every country in the data except `-` and `Other`, plus Canada, Australia, New Zealand, France, Spain, Portugal, Italy, Netherlands, Ireland, Poland, Ukraine, Romania, Sweden, Switzerland, Israel, Pakistan, Bangladesh, Philippines, Vietnam, Indonesia, Egypt, Kenya and South Africa.
- **Aliases** (case-insensitive):

  | Alias | Country |
  |---|---|
  | `us`, `usa`, `u.s.`, `u.s.a.`, `america`, `united states of america` | United States |
  | `uk`, `u.k.`, `britain`, `great britain`, `england` | United Kingdom |
  | `uae`, `emirates` | United Arab Emirates |
  | `brasil` | Brazil |
  | `méxico` | Mexico |

- `canonicalCountry`: case-insensitive exact match on a name or alias → the canonical name; anything else → null.
- `findCountries`: whole-word, case-insensitive matches of names and aliases. It must not match inside another word: "Indiana" is not India, "plus" is not US. Exception: in `findCountries`, the aliases `us`, `usa`, `u.s.` and `u.s.a.` match **only when written in capitals** (`US`, `USA`, `U.S.`, `U.S.A.`), so the ordinary word "us" is ignored. `canonicalCountry` stays case-insensitive for all aliases.

#### Rule-based parser (`parseQueryWithRules`)
Applied to the trimmed query:

1. **Salary** (annual USD). Numbers may have `$`, commas and a `k` suffix (×1000). A number under 1,000 without `k` is not a salary.
   - **Monthly:** followed by `/mo`, `/month`, `per month`, `a month` or `monthly` → ×12.
   - **Max:** after `under`, `below`, `less than`, `max`, `maximum`, `up to`, `at most`, `<`, `<=` or `≤`.
   - **Min:** after `over`, `above`, `more than`, `min`, `minimum`, `at least`, `>`, `>=` or `≥`.
   - **Range:** `between A and B`, or `A-B` / `A–B` / `A to B` → min A, max B. `100-130k` means 100k–130k: a `k` on the second number applies to both.
   - Phrases whose unit is years (see step 2) are never salary.
2. **Years:**
   - `N+ years`, `N+ yrs`, `N+ yoe`, `at least N years`, `more than N years`, `over N years`, `min N years` → `minYears N`.
   - `under N years`, `less than N years`, `up to N years`, `at most N years`, `max N years` → `maxYears N`.
   - `N-M years` / `N to M years` → both.
   - `N years` with no qualifier → `minYears N`.
   - `year`/`years`/`yr`/`yrs`/`yoe` are the accepted units.
3. **Seniority word**, whole word, case-insensitive:
   - `junior`/`jr` → `junior`
   - `mid`/`mid-level`/`intermediate` → `mid`
   - `senior`/`sr` → `senior`
   - `lead`/`staff`/`principal` → `lead`
4. **Countries:** `findCountries(q)`.
5. **Skills:** `extractSkills(q)` from `src/lib/derive/skills.ts`.
6. **Keywords:** lowercase tokens (same token rule as `toFtsQuery`: `/[\p{L}\p{N}][\p{L}\p{N}+#.]*/gu`, trailing `.` stripped), with these removed:
   - every token that is part of a matched salary, years, seniority or country phrase
   - any token that `extractSkills` maps to a skill on its own, checked **in its original case from the query** (so `AI` and `ML` count but lowercase `go` doesn't), or that is part of a multi-word skill (e.g. `machine`, `learning`)
   - stopwords: `a an and the in of for with to at on or who has have having is are be from based plus strong good great solid experience experienced exp engineer engineers developer developers dev devs candidate candidates someone looking need needs want wants role position job knowledge background skills skilled working work worked expert expertise years year yrs yr yoe`
   - numbers and tokens under 2 characters
   - duplicates (first occurrence kept)
7. **searchText:** the query with the salary, years and country phrases removed (seniority and skills are kept, since they describe the person). Collapse whitespace, then strip leftover connector words at the ends (`in`, `with`, `under`, `from`, `based in`) and punctuation. If the result is empty, use the query.
8. The result goes through `normalizeParsed(raw, 'rules')`.

#### normalizeParsed (shared by both parsers)
- **skills:** each is matched case-insensitively to `SKILLS`. If that fails, `extractSkills(term)` is tried and its matches used. A term that matches nothing moves to `keywords` (lowercased). Deduplicated, in first-mention order.
- **Domain skills rank, they don't filter** (added after wave 3, user decision): `AI`, `Machine Learning`, `NLP`, `LLM` and `Blockchain` are *domain skills*. If the normalized skills include **at least one non-domain skill**, every domain skill is removed from `skills` and appended to `keywords` as its lowercased canonical name (`ai`, `machine learning`, `nlp`, `llm`, `blockchain`). If **all** skills are domain skills (e.g. "ML engineer"), they stay as required skills.
- **countries:** `canonicalCountry`. An unknown country is kept as written, title-cased (so "Atlantis" stays a filter and relaxation explains it). Deduplicated.
- **Numbers:** anything that isn't a finite number ≥ 0 → null. If min > max for years or salary, swap them.
- **Seniority → years:** only when **both** `minYears` and `maxYears` are null:
  - junior → max 3
  - mid → min 3, max 7
  - senior → min 5
  - lead → min 8
- **keywords:** lowercased, trimmed, deduplicated, empties dropped. Any keyword equal (case-insensitive) to a chosen skill or country is dropped.
- **searchText:** trimmed. If empty, use the skills and keywords joined with spaces.
- **Output:** `ParsedQuery`, with `filters` holding every field (empty arrays or nulls where nothing was found).

#### LLM parser (`parseQuery`)
- `''` or whitespace → `null`.
- **Cache:** an in-memory cache keyed by the lowercased trimmed query, at most 200 entries, evicting the oldest first. A hit returns the stored result without calling the model.
- **When the LLM is used:**
  - If `options.complete` is given, it's used.
  - Otherwise, if `OPENAI_API_KEY` is set and isn't the placeholder, the default `CompleteFn` calls OpenAI chat completions:
    - model `CHAT_MODEL`, temperature 0
    - `response_format` json_schema, strict, matching `RawParsedQuery`
    - a system prompt explaining each field. In short: skills = technologies the candidate must have; domains and topics go to keywords; salary is annual USD, with monthly converted; searchText = the role, stack and domain phrase without location and salary.
  - The default has a 6-second timeout.
- **Parsing the output:** the returned JSON goes through `JSON.parse`, then a Zod check against `RawParsedQuery`, then `normalizeParsed(raw, 'llm')`.
- **Fallback:** any error (no key, network, timeout, bad JSON, schema mismatch) falls back to `parseQueryWithRules(q)`. The result says `source: 'rules'`. Nothing is thrown.
- Fallback results are cached too.

#### mergeFilters
- **Arrays** (countries, skills): explicit wins if non-empty; otherwise parsed.
- **Numbers:** explicit wins if not null; otherwise parsed.
- **`fromQuery`:** the fields whose value came from `parsed` **and** is non-empty or non-null. Listed in `SearchFilters` field order: countries, skills, minYears, maxYears, minSalary, maxSalary.

#### Route (`src/app/api/candidates/search/route.ts`, S4-back owns it)
1. `parseSearchParams`. Invalid → 400, as before.
2. `q = parseQueryParam(params)`.
   - **No q:** return `searchCandidates(filters)`. The response is exactly as in S3, with `query: null`, `interpretation: null`, `relaxed: []`.
   - **With q:**
     1. `parsed = await parseQuery(q)`
     2. `{ filters: merged, fromQuery } = mergeFilters(explicit, parsed.filters)`
     3. `searchCandidates(merged, { query: parsed, queryText: q, relaxable: fromQuery })`, which is S5's contract (see `docs/slices/S5-ranking-explanations.md`)
     4. return 200.
3. Any unexpected error → 500 `{ error: 'Search failed' }`.

### Clarifications (added after the test pass)
- `parseQueryParam` returns `''` for a missing `q` **and** for a blank one (`q=%20%20`).
- The parse cache key is the query lowercased and trimmed at both ends; whitespace inside isn't collapsed.
- The rules-parser stopword list includes `engineers`, so `Senior React engineers in Canada under 130k` parses the same as the singular form.
- The route returns every `SearchResponse` field, and `query` is the trimmed `q`.

### Test list: S4-back (`tests/s4/back/*.test.ts`)

**countries**
1. `canonicalCountry('usa')` → `'United States'`. `('Brasil')` → `'Brazil'`. `('canada')` → `'Canada'`. `('Atlantis')` → `null`. `('Other')` → `null`.
2. `findCountries('React dev in Canada or the UK')` → `['Canada', 'United Kingdom']`.
3. `findCountries('Indiana plus us')` → `[]`. `findCountries('based in the US')` → `['United States']`.

**parseQueryWithRules** (check `filters`, `keywords` and `seniority`, `source: 'rules'`)
4. `'Senior React engineer in Canada under 130k'` → skills `['React']`, countries `['Canada']`, maxSalary `130000`, seniority `'senior'`, minYears `5`, maxYears `null`, keywords `[]`.
5. `'Rust developer with 5+ years experience in AI/ML'` → skills `['Rust']`; minYears `5`; seniority `null`; keywords `['ai', 'machine learning']` (order as appended: the order the domain skills appear in the normalized skills list). *(Changed after wave 3: domain skills rank, they don't filter.)*
6. `'python data engineer, max $8k/month, Brazil'` → skills `['Python']`, countries `['Brazil']`, maxSalary `96000`, keywords include `'data'`.
7. `'backend between 60k and 90k'` → minSalary `60000`, maxSalary `90000`, keywords `['backend']`.
8. `'java 3-6 years'` → minYears `3`, maxYears `6`, skills `['Java']`.
9. `'junior frontend'` → seniority `'junior'`, maxYears `3`, minYears `null`, keywords `['frontend']`.
10. `'senior with 2+ years'` → minYears `2` (explicit years beat seniority), maxYears `null`.
11. `'fintech payments'` → no filters, keywords `['fintech', 'payments']`, searchText `'fintech payments'`.
12. `'under 5 years of go'` → maxYears `5`, maxSalary `null`.
13. `'100-130k react'` → minSalary `100000`, maxSalary `130000`.

**normalizeParsed**
14. Raw skills `['reactjs', 'Kubernetes', 'fintech']` → skills `['React', 'Kubernetes']`, and keywords include `'fintech'`.
15. Raw countries `['usa', 'atlantis']` → `['United States', 'Atlantis']`.
16. Raw minSalary `150000`, maxSalary `90000` → swapped to 90000 / 150000. Raw minYears `-1` → `null`.
17. Seniority `'lead'` with no years → minYears `8`. Seniority `'lead'` with maxYears `4` → minYears `null`, maxYears `4`.
18. Keywords `['React', 'fintech', 'Fintech', ' ']` with skills `['React']` → keywords `['fintech']`.
18b. Raw skills `['Rust', 'AI', 'Machine Learning']`, keywords `['fintech']` → skills `['Rust']`, keywords `['fintech', 'ai', 'machine learning']`.
18c. Raw skills `['Machine Learning', 'NLP']` (domain only) → skills `['Machine Learning', 'NLP']`, keywords `[]`.
18d. Raw skills `['Python', 'Blockchain']`, keywords `['blockchain']` → skills `['Python']`, keywords `['blockchain']` (no duplicate).

**parseQuery**
19. `''` → `null`.
20. A `complete` returning valid JSON for `'Senior React engineer in Canada under 130k'` (skills `['React']`, countries `['Canada']`, maxSalary 130000, seniority `'senior'`, keywords `[]`, searchText `'Senior React engineer'`) → `source: 'llm'`, filters as given plus minYears `5`.
21. A `complete` that throws → `source: 'rules'`, same filters as case 4.
22. A `complete` returning `'not json'` → `source: 'rules'`.
23. Calling twice with the same query (different case or whitespace) → `complete` is called once.

**mergeFilters**
24. Explicit countries `['Brazil']`, parsed countries `['Canada']` and maxSalary 130000 → countries `['Brazil']`, maxSalary `130000`, fromQuery `['maxSalary']`.
25. Explicit all empty, parsed skills `['React']` and minYears 5 → fromQuery `['skills', 'minYears']`.

**Route** (skip if `local.db` is missing; set `process.env.OPENAI_API_KEY = ''` before importing, so the rules parser runs with no network)
26. `?q=Rust%20developer%20with%205%2B%20years` → 200, `query` `'Rust developer with 5+ years'`, `interpretation.source` `'rules'`, `interpretation.filters.skills` includes `'Rust'`, and `filters.minYears` is `5`.
27. `?q=%20%20` → 200 with `query: null`, `interpretation: null`, `relaxed: []`.
28. `?q=react&skill=Python` → `filters.skills` `['Python']` (explicit wins), and `interpretation.filters.skills` `['React']`.

---

## S4-front

### Component contract changes (additive; S3 behaviour and tests stay valid)

```ts
// src/lib/search-query.ts
export function buildSearchQuery(filters: SearchFilters, q?: string): string;
// q (trimmed) goes first as `q=...` when non-empty; otherwise the output is unchanged from S3.

// src/components/search/search-page.tsx
export function SearchPage(props: {
  options: FilterOptions;
  initialFilters: SearchFilters;
  initialQuery?: string; // default ''
  fetchResults: (filters: SearchFilters, q?: string) => Promise<SearchResponse>;
}): React.ReactElement;
```

**Compatibility rule:** when the current query is empty, `fetchResults` is called with **exactly one argument** (`fetchResults(filters)`) and the URL is `'?' + buildSearchQuery(filters)`, exactly as in S3. When the query is non-empty, it's called as `fetchResults(filters, q)`.

### Behaviour
- **Search form:** a `<form role="search">` above the results. It contains:
  - an input with `type="search"`, labelled **Search candidates**, and placeholder `e.g. Senior React engineer in Canada under 130k`
  - a submit button named **Search**
- **Typing does not fetch.** Submitting (Enter or the button) fetches **immediately** (no debounce) with the current filters and the trimmed query. It also updates the URL to `'?' + buildSearchQuery(filters, q)`.
- **Filter changes** keep the debounced behaviour from S3 and use the **last submitted** query (not unsubmitted typing).
- **Mount:** fetches once with `initialFilters` and `initialQuery`, following the compatibility rule. The input starts with `initialQuery`.
- **Interpretation:** when `response.interpretation` is non-null, render `<ul aria-label="Interpreted as">` with one `li` per chip, in this order:
  1. each skill
  2. each country
  3. years: `{min}+ yrs`, `≤ {max} yrs` or `{min}–{max} yrs`
  4. salary: `≤ $130,000/yr`, `≥ $60,000/yr` or `$60,000–$90,000/yr`, with commas
  5. seniority, capitalised (`Senior`)
  6. each keyword in curly quotes (`“fintech”`)

  After the list, show a small note: `Read by AI` for `source: 'llm'`, `Read by keyword rules` for `'rules'`.
- **Relaxation:** when `response.relaxed` is non-empty, render an element with `role="note"` containing each message, one per line.
- **Snippets:** `ResultCard` renders `reason.snippet`, when present, under that reason's label. Text between `⟪` and `⟫` goes in `<mark>`, and the marker characters themselves are never shown.
- **Clear filters** clears filters only, not the query.

### Clarifications (added after the test pass)
- **Submitting fetches synchronously:** the `fetchResults` call happens in the submit handler, with no timer.
- **URL during a query:** after a filter change while a query is active, the URL is `'?' + buildSearchQuery(filters, lastSubmittedQuery)`. `q` stays in shareable links.
- **Source note:** `Read by AI` / `Read by keyword rules` is the entire text of its own element.
- **Snippet placement:** the snippet sits inside the same `li` as its reason label, after the label. Each matched word is its own `<mark>`.
- **Summary line:** keeps the S3 format (`{total} candidates match · showing top {n}`).

### Test list: S4-front (`tests/s4/front/*.test.tsx`, first line `// @vitest-environment jsdom`)
29. `buildSearchQuery(EMPTY_FILTERS, ' rust dev ')` → `'q=rust+dev'`. `buildSearchQuery(mockSearchResponse.filters, 'x')` → `'q=x&country=Brazil&skill=React&minYears=5&maxSalary=120000'`. `buildSearchQuery(EMPTY_FILTERS, '  ')` → `''`.
30. With `initialQuery` `'rust'`: mount calls `fetchResults(initialFilters, 'rust')`, and the input shows `rust`.
31. With no `initialQuery`: mount calls `fetchResults` with exactly one argument.
32. Typing in **Search candidates** without submitting makes no new call, even after 1s.
33. Typing `react lead` and pressing Enter → one immediate call with `(filters, 'react lead')`, and `window.location.search` is `'?q=react+lead'`.
34. After submitting `rust`, a filter change (checking **Brazil**) → one debounced call with `countries ['Brazil']` and `'rust'`.
35. Rendering `mockNlSearchResponse` → the **Interpreted as** list items are exactly `React`, `Canada`, `5+ yrs`, `≤ $130,000/yr`, `Senior`, `“fintech”`, and the text `Read by AI` is shown.
36. `mockNlSearchResponse` → `role="note"` contains `No candidates in Canada match, so country was ignored.`
37. `mockSearchResponse` (no interpretation, `relaxed: []`) → no **Interpreted as** list and no `role="note"`.
38. `ResultCard` with `mockNlSearchResponse.results[0]` → a `mark` with the text `fintech`, and the card's text contains neither `⟪` nor `⟫`.

## Files owned
- **S4-back:**
  - `src/lib/search/countries.ts`, `rules-parser.ts`, `query-parser.ts`, `merge.ts`
  - `parseQueryParam` added to `src/lib/search/params.ts`
  - `src/app/api/candidates/search/route.ts`
  - `tests/s4/back/*` (test agent)
- **S4-front:**
  - `src/lib/search-query.ts`
  - `src/components/search/search-page.tsx`, `result-card.tsx`
  - new files under `src/components/search/`
  - `tests/s4/front/*` (test agent)
- **Main, after merge:** `src/app/page.tsx` (reads `q` → `initialQuery`) and `src/components/search/search-app.tsx` (`fetchResults(filters, q)`), then a browser check.

## Done checklist
- [ ] back: tests written
- [ ] back: implementation passes
- [ ] front: tests written
- [ ] front: implementation passes
- [ ] page wired; checked in the running app with and without an API key
- [ ] typecheck + lint clean; committed; PROGRESS.md updated

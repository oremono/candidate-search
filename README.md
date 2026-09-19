# Candidate Search

A recruiter-facing search over 1,000 anonymized software engineers. You can **filter** by country, skills, years of experience and salary, or **describe who you need in plain words** ("Senior React engineer in Canada under 130k"). You get the top 10 candidates, each with a short explanation of why they matched. The brief is in [CHALLENGE.md](./CHALLENGE.md).

Built with Next.js 16 (App Router), TypeScript, Tailwind, SQLite via Drizzle + libsql (with FTS5 and native vectors), and OpenAI (`gpt-4o-mini` for query parsing, `text-embedding-3-small` for resumes).

## Quick start

Requires Node 20.9 or newer.

```bash
npm install
cp .env.example .env        # add your OPENAI_API_KEY
npm run db:seed             # loads the CSVs, derives data, builds the keyword index and embeddings (~10–30s)
npm run dev                 # http://localhost:3000
```

**No API key?** Everything still works. The seed skips embeddings and says so, and queries fall back to a rule-based parser plus keyword search. Add a key later and run `npm run db:embed` to add semantic search.

Already have a `local.db` from the starter? Run `npm run db:reset`, because `db:seed` skips when candidates already exist.

## Scripts

| Command                                 | What it does                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                           | Start the dev server                                                                                          |
| `npm run db:seed`                       | Migrate, load the CSVs, derive fields, build the keyword index, embed resumes. Skips if data exists           |
| `npm run db:reset`                      | Wipe and rebuild everything                                                                                   |
| `npm run db:embed`                      | Embed new or changed resumes (`-- --force` redoes all). Unchanged resumes are skipped by content hash         |
| `npm test`                              | Vitest: 212 unit, DB and component tests (`npx vitest run tests/s5` for one folder, `-t "name"` for one test) |
| `npm run lint` / `typecheck` / `format` | ESLint / `tsc --noEmit` / Prettier                                                                            |
| `npm run db:generate` / `db:studio`     | New Drizzle migration / browse the DB                                                                         |

## Using it

- **Plain-language search:** type a query and press Enter.
  - The app shows how it read the query as chips, e.g. `React` `Canada` `5+ yrs` `≤ $130,000/yr` `Senior`, and whether the AI or the keyword rules read it.
  - If the query's own constraints match nobody, it drops them one at a time and says so, e.g. "No candidates in Canada match, so country was ignored." It never silently shows an empty page.
- **Filters:** country, skills, years and annual salary. Filters you set yourself always win over anything read from the query.
- **Results:** the top 10, each with reasons such as:
  - `React in 13 roles and bio`
  - `Resume mentions fintech`, with the matching excerpt highlighted
  - `Top 3% resume match for "Senior React engineer"`
  - `10.7 yrs experience (min 5)`
  - `$60,000/yr, under $130,000`
- **Profile page** (`/candidates/[id]`):
  - the full experience timeline, showing which jobs count toward years of experience and why others don't
  - education
  - skills with their evidence ("React · 3 roles · bio")
  - the searched skills highlighted in the text, including spellings like "ReactJS"
- **Shareable URLs:** the query and filters live in the URL, e.g. `/?q=rust+ai&country=Brazil&minYears=5`.

## How search works

```
query ──► parse (LLM, or rules fallback) ──► merge with explicit filters
                                                   │
                     hard filters in SQL ◄─────────┘   (country, all skills, years, salary)
                            │  empty? drop query-derived constraints one at a time, and say so
                            ▼
      rank = 0.55 semantic + 0.25 keyword + 0.20 skill evidence   (only the signals available)
                            │
                            ▼
              top 10 + deterministic explanations
```

- **Parsing** (`src/lib/search/query-parser.ts`, `rules-parser.ts`):
  - `gpt-4o-mini` with a strict JSON schema turns the query into skills, countries, years, annual salary, seniority, leftover keywords, and a `searchText` describing the person.
  - Any failure (no key, timeout, bad output) falls back to a rule-based parser. Both paths go through the same normalization step.
  - Parses are cached in memory.
  - "Senior" means 5+ years unless the query gives years itself.
  - Domain skills (AI, ML, NLP, LLM, Blockchain) boost ranking rather than filter when another skill is named. So "Rust developer … in AI/ML" returns Rust developers ranked by AI/ML evidence, instead of the one person tagged with all three.
- **Hard filters** (`src/lib/search/filter-search.ts`): one SQL query.
  - Skills must all be present.
  - Salary filters compare annual salary with the monthly rate × 12, and never include rates flagged as unverified.
- **Keyword signal:** SQLite FTS5 (porter stemming, bm25) over the bio, roles and education, with snippets for the explanations.
- **Semantic signal:** one embedding per resume, stored in libsql's native `F32_BLOB` column type and ranked with `vector_distance_cos`.
  - Raw cosine similarities aren't comparable across queries: the top match ranged 0.41–0.55 in testing. So a candidate's strength is their percentile among all 1,000 resumes, which is also what "Top 3%" means.
- **Skill evidence:** how many roles mention the skill, plus one if the bio does.
- **Explanations** are built from the same data the ranking used, without an LLM. They're instant and can't claim something the data doesn't support.

Without a query, search is plain filtering, ranked by skill evidence and then years of experience.

## Data decisions

The CSVs are messy, so these fields are derived at seed time (`src/lib/derive/`):

- **Years of experience:**
  - A job with no end date means the person still works there. With several such jobs (681 candidates have 2+, mostly promotions that were never closed), each ends when the next one starts, and only the latest runs to today.
  - Overlapping jobs are merged.
  - Internships, trainee and student roles, volunteering and career breaks don't count. The profile page shows them marked as not counted.
- **Rates:** full-time monthly rates of 0, under $500, or over $30,000 (204 candidates, mostly INR or annual figures entered as monthly USD) are marked **unverified**. They show "Rate unverified" and are left out of salary filters rather than guessed.
- **Skills:** there's no skills column. A dictionary of 51 skills with aliases (e.g. `ReactJS` → React, `k8s` → Kubernetes) tags each candidate from their bio and roles, keeping how many roles mention each skill. It's careful with word boundaries: `JavaScript` isn't Java, `React Native` isn't React, lowercase "go" isn't Go. Embeddings cover everything the dictionary misses.
- **Countries:** India 675, Brazil 227, and a long tail. There's no one in Canada, which is why the brief's own example query needs relaxation.

## API

| Endpoint                                                                                     | Returns                                                                                                             |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GET /api/candidates/search?q=…&country=…&skill=…&minYears=&maxYears=&minSalary=&maxSalary=` | `SearchResponse`: interpretation, relaxations, effective filters, total, top 10 with reasons. 400 on invalid params |
| `GET /api/candidates/filters`                                                                | Countries and skills with counts                                                                                    |
| `GET /api/candidates/[id]`                                                                   | `CandidateProfile`, 404 if unknown                                                                                  |

`country` and `skill` repeat. Salaries are annual USD. All types are in `src/lib/contracts.ts`.

## Project layout

```
src/lib/contracts.ts        API types shared by server and UI
src/lib/derive/             years of experience, rate cleanup, skill extraction (seed time)
src/lib/search/             params, query parsing, filters, keyword + semantic search, ranking, relaxation
src/lib/profile.ts          candidate profile loader
src/components/search/      search page, filter panel, query form, interpretation, result card
src/components/profile/     profile view, highlighting
src/app/                    pages and API routes
src/db/                     schema, seed, embed
tests/sN/                   tests per feature slice (vitest + Testing Library)
docs/                       PROGRESS.md (status, decision log) and per-slice specs
```

## How it was built

It was built in vertical slices (S0–S7 in `docs/PROGRESS.md`). Each slice started from a written spec with input → expected cases. Tests and implementation were written by **separate AI agents** from that spec, and the implementing agent never saw the tests. Independent slices ran in parallel git worktrees. More in [AI_USAGE.md](./AI_USAGE.md).

## Known limitations

- Multi-word keywords are searched word by word, so "machine learning" can match on "learning" alone.
- A few skill-tagging false positives remain, e.g. "Spring 2020" tags Spring.
- On a phone, the filter panel comes before the results.
- The home page fetches results after it loads, rather than rendering them on the server.

# Candidate Search Challenge

Starter repo for the Bolto candidate search take-home. The brief is in [CHALLENGE.md](./CHALLENGE.md).

You get a Next.js 16 app (App Router, TypeScript, Tailwind), a local SQLite database managed with Drizzle, three CSVs of anonymized candidate data, and a seed script. Everything else is yours to build.

## Quick start

Requires Node 20.9 or newer.

```bash
npm install
cp .env.example .env        # add your OPENAI_API_KEY
npm run db:seed             # creates local.db and loads the CSVs
npm run dev                 # http://localhost:3000
```

The home page shows row counts from the database so you can confirm the seed worked. `GET /api/candidates/search?q=react` is a stub for you to implement.

## Scripts

| Command               | What it does                                                       |
| --------------------- | ------------------------------------------------------------------ |
| `npm run dev`         | Start the dev server                                               |
| `npm run db:seed`     | Apply migrations and load the CSVs. Skips if data exists           |
| `npm run db:reset`    | Wipe and reload all data                                           |
| `npm run db:embed`    | Embed new or changed resumes with OpenAI (`-- --force` redoes all) |
| `npm run db:generate` | Generate a new migration after editing `src/db/schema.ts`          |
| `npm run db:studio`   | Browse the database in Drizzle Studio                              |
| `npm run lint`        | ESLint                                                             |
| `npm run typecheck`   | `tsc --noEmit`                                                     |
| `npm run format`      | Prettier                                                           |

## Configuration

Copy `.env.example` to `.env` and set `OPENAI_API_KEY` to the key we sent you. That is the only variable.

`src/lib/openai.ts` has a configured client and an `embed()` helper. You may use a different provider or a local model if you prefer.

The database is the file `local.db` in the repo root. It is gitignored; recreate it any time with `npm run db:seed`.

## Project layout

```
candidates.csv, education.csv, experiences.csv   source data (1,000 candidates)
migrations/                                      Drizzle SQL migrations
src/db/schema.ts                                 Drizzle tables + Zod schemas for the CSVs
src/db/index.ts                                  shared db client
src/db/seed.ts                                   migrate + load CSVs
src/lib/openai.ts                                OpenAI client, embed() helper
src/app/page.tsx                                 placeholder home page
src/app/api/candidates/search/route.ts           search endpoint stub
ai-sessions/                                     put your exported AI chat sessions here
AI_USAGE.md                                      short questionnaire, fill in before submitting
```

## Data model

- **candidates**: name, country, biography, availability flags (`fullTime`, `partTime`, `contractor`, `employee`), start dates, and expected **monthly** rates in USD.
- **education**: school, degree, start and end dates, per candidate.
- **experiences**: company, position, free-text description, start and end dates, per candidate. Years of experience is not stored and must be derived.

The data is real but anonymized and a little messy: some dates are missing and a few monthly rates are 0 or implausibly small. Handle that however you think a recruiter would want.

Edit `src/db/schema.ts` and run `npm run db:generate` to add tables or columns (for example, an embeddings table). Then `npm run db:reset` to rebuild.

## Submitting

Push to `main` in the private repo we invited you to. We will clone it and run `npm install`, `npm run db:seed`, and `npm run dev`, so make sure that path works from a clean checkout. If your search needs precomputed data such as embeddings, document the command that generates it.

Include your AI session exports in `ai-sessions/` and fill in `AI_USAGE.md`. See the "Working With AI" section of [CHALLENGE.md](./CHALLENGE.md) for how to capture sessions cleanly.

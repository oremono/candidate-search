# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start here

Read `docs/PROGRESS.md` first. It has the current slice, the current step, and the one-line **Next action**. Read that slice's spec in `docs/slices/`, run the tests, then resume. At the end of a session: update PROGRESS.md, commit, and export the session into `ai-sessions/`.

## What this is

Take-home: a Next.js 16 (App Router, TypeScript, Tailwind) recruiter search over 1,000 anonymized engineers in SQLite, using Drizzle + libsql. Brief: `CHALLENGE.md`. Required features:

- filter search
- natural-language search (extract filters + match on resumes)
- top-10 results, each with a "why matched" explanation

## Commands

```bash
npm run dev          # http://localhost:3000
npm run db:seed      # migrate + load CSVs into local.db (skips if data exists)
npm run db:reset     # wipe and reload
npm run db:generate  # new migration after editing src/db/schema.ts
npm run lint
npm run typecheck
npm run format
npm test                              # vitest run (tests live in tests/)
npx vitest run tests/s1/rate.test.ts  # one file
npx vitest run -t "overlap"           # tests whose name matches
```

Evaluators run `npm install && npm run db:seed && npm run dev` from a clean checkout. Anything search needs, such as derived data, indexes or embeddings, must be produced by that path.

## Architecture

- `src/db/schema.ts`: Drizzle tables plus the Zod schemas that coerce raw CSV strings. `src/db/seed.ts` applies migrations, then loads `candidates.csv`, `education.csv` and `experiences.csv`. It maps each CSV `userId` to the auto-increment candidate `id`.
- `src/db/index.ts`: shared client, using `casing: 'snake_case'`. TypeScript fields are camelCase; the matching SQL columns are snake_case.
- `src/lib/openai.ts`: `getOpenAI()` and `embed()`, with models `text-embedding-3-small` and `gpt-4o-mini`. The only env var is `OPENAI_API_KEY`, set in `.env`.
- `next.config.ts` keeps `@libsql/client` out of the server bundle because it has native bindings, and sets `agentRules: false`.
- Schema change workflow: edit `schema.ts`, run `db:generate`, then `db:reset`. ESLint ignores `migrations/`.

## Data rules (agreed; see decision log in PROGRESS.md)

- Rates are **monthly USD**, but queries use annual amounts ("130k"). FT rates of `0`, under `500`, or over `30000` are unusable (mostly INR or annual figures from India). They're flagged unknown and left out of salary filters.
- Years of experience isn't stored; it's derived:
  - A job with no end date means the person is still there. It runs until the next open-ended job starts, or until today if it's the latest.
  - Open-ended jobs with the same start date all run to today.
  - Overlapping jobs are merged.
  - Internships and career breaks are excluded.
- There's no skills column. Skills come from bio, position and description text, plus embeddings.
- Countries are skewed: India 675, Brazil 227, no Canada. `Other` and `-` mean unknown.

## How work is done

- Build in vertical slices (S0–S7 in PROGRESS.md), in this order:
  1. tests
  2. backend
  3. frontend tests
  4. frontend
  5. check in the running app
  6. commit
- Commit messages start with the slice ID, e.g. `S3: filter API tests`.
- Tests and implementation are written by **separate agents** from the slice spec. The implementation agent never reads or edits test files. Test failures are relayed as "input → expected → got", not as test code.
- Independent slices, and the backend/frontend halves of one slice, run in parallel git worktrees. The API contract and mock fixture are committed first. The main session merges one branch at a time and reruns all tests.

## Style

Prettier: single quotes, semicolons, 100-character lines, `trailingComma: es5`. Path alias `@/*` → `src/*`.

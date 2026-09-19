# AI Usage

> **DRAFT written by Claude from the session history. Rewrite it in your own words before submitting, and delete this note.**

## Tools

Claude Code (Opus 5) in the Claude desktop app. One main session planned and coordinated the work and started sub-agents in separate git worktrees; a second session did a few follow-up fixes. AI wrote nearly all of the code and tests. I wrote no application code by hand. My part was the decisions, the specs' content, reviewing agent reports and steering.

## What you delegated, what you kept

**Delegated:** writing tests and implementations from written specs, data profiling, browser checks and README drafting.

**Kept:**
- **Scope and order.** I made the AI agree on scope, build order and test cases before any technical plan, and I rejected its first plan because it jumped straight into architecture.
- **The workflow.** Vertical slices, tests first, a `docs/PROGRESS.md` any fresh session can resume from, and parallel agents in worktrees. I also required that the agent writing tests is never the agent writing code, and that the implementer never sees the tests. The point is that code can't be written just to pass tests: failures were passed on only as "input → expected → got".
- **Data rules**, e.g. that a job with no end date means the person still works there, and how to split several open-ended jobs.
- **Product calls**, e.g. treating AI/ML as ranking keywords rather than required skills.

## Where it was wrong

- **Over-strict parsing.** For the brief's "Rust developer with 5+ years experience in AI/ML", the LLM parser made AI and Machine Learning required skills alongside Rust. That returned a single candidate. I noticed while checking the brief's example queries in the running app. The fix was a spec rule that domain skills rank rather than filter when another skill is named, with new tests. It now returns the 5 Rust developers, ranked by AI/ML evidence.
- **Silently stale progress file.** The AI edited `docs/PROGRESS.md` with string-replacement scripts. After Prettier re-padded a table, those replacements silently matched nothing, and the status table sat stale for a while (S1 still "spec ready" after it was done). It was caught on a later check. The file was rewritten, and a note now says to use real edits.
- **Mangled specs.** Prettier merged the numbered test lists in the spec docs into paragraphs, and removed the spaces inside code spans like `` ` OR ` ``. That changed the meaning of a spec. The lists were restored and `docs/` excluded from Prettier.
- **Missed highlighting.** Profile highlighting missed most matches, because resumes say "ReactJS" while the searched skill was "React". It was found in the browser and fixed with a spelling list.
- **Worktrees on an old base.** Agent worktrees started from the pushed `origin/main` rather than local commits, so early agents saw old specs. They fast-forwarded themselves; after that I pushed before each round.

## What you would not trust it with

- **Interpreting messy data without checking it against the raw rows.** The AI proposed rules for rates, dates and seniority that looked reasonable. The real distribution (84 of 92 huge "monthly" rates are from India, and 681 candidates have several open-ended jobs) changed the right answer.
- **Ranking weights and "what a good result is".** Those need a human looking at real results.
- **Anything touching the API key.** Agents were told never to print `.env`. I'd still scan the session exports for the key before committing.

## Session history

`ai-sessions/`. Export the main session with `/export`. Sub-agent transcripts are part of the session files under `~/.claude/projects/<repo path>/`; copy those `.jsonl` files too. **Before committing, search the exports for `sk-proj` and remove any match.**

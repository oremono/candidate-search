---
name: delivery-workflow
description: How the user wants multi-part work delivered — vertical slices, test-first, progress-file handoff, parallel worktree agents with front/back split
metadata:
  type: feedback
---

Plan *how* work is delivered before technical design. Build in vertical feature slices, one at a time: tests → backend → frontend tests → frontend → verify in app → commit + update progress + export session. Run independent slices (and backend/frontend within a slice, frontend against a mock of a committed API contract) as parallel agents in separate git worktrees; main session merges one branch at a time and reruns all tests. Max ~4 agents at once.

Handoff: committed `docs/PROGRESS.md` (status table, current slice/step, one-line Next action, blockers, decision log) + `docs/slices/SN-*.md` specs; CLAUDE.md tells new sessions to read PROGRESS.md, run tests, resume. Commit per step with slice ID in message.

**Why:** User wants fresh sessions to resume from repo state alone and to parallelise independent work (candidate-search challenge, 2026-09-19). Rejected a tech-first plan: "skip all tech details, we will do that 2nd."

**How to apply:** For new multi-part work, propose slices + waves + handoff files first; technical design second. See [[test-author-isolation]], [[scope-before-build]].

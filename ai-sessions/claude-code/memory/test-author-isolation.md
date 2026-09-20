---
name: test-author-isolation
description: Never let the same agent write tests and the code they test; implementer must not see the tests
metadata:
  type: feedback
---

Tests and implementation are written by separate fresh agents, both working only from a shared spec (behaviour, input→expected output, API contract). The implementer never opens or edits test files. On failure, main session relays a spec-level description ("input X → expected Y, got Z"), not test code. Suspect tests go back to a test agent, never the implementer.

**Why:** User: an agent that knows the tests is biased and writes code just to pass them.

**How to apply:** Every slice needs a precise written spec before spawning agents; tests and code can then run in parallel. Related: [[delivery-workflow]].

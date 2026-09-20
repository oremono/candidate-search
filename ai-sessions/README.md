# AI sessions

Raw Claude Code transcripts, in `claude-code/`. File names are session UUIDs, so here's what each one is. All of it happened on 19 September 2026; times below are UTC.

| File                   | What it is                                                                                                                                                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `9c237e0c…`            | **First planning session** (10:08–18:42). Read the brief, profiled the CSVs, and agreed scope, build order and test cases. Its first plan was rejected for jumping to architecture too early.                                                               |
| `0b24aae2…`            | **Main build session** (11:39–18:41). Everything from S0 to S7: the specs, the shared contract, all agent rounds, merges, browser checks, README and `AI_USAGE.md`. The largest file.                                                                       |
| `0b24aae2…/subagents/` | **20 sub-agents**, one file per agent, `.jsonl` plus a `.meta.json` naming it, e.g. `Write S1 tests from spec`, `Implement S2 search index`. Test agents and implementation agents are always separate, and implementers never saw the tests.               |
| `51073e43…`            | **Follow-up session** (18:11–18:26): the "MERN stack from India under 2k per month" query. Added stack acronyms (MERN/MEAN/MEVN), an Express skill, and a guard on the years and seniority the LLM returns. Its 2 sub-agents are in `51073e43…/subagents/`. |
| `5bced6ae…`            | **Short check-in session** (12:35–15:55): "check the progress and tell me next steps", answered from `docs/PROGRESS.md`.                                                                                                                                    |
| `memory/`              | Notes Claude kept across sessions: agree scope before building, the delivery workflow, and keeping test authors separate from implementers.                                                                                                                 |

Each session folder also has a `custom-title.json` with the title shown in the app.

## Reading them

They're JSON Lines, one message per line. To skim one:

```bash
python3 -c "
import json,sys
for line in open(sys.argv[1]):
    d=json.loads(line)
    if d.get('type') in ('user','assistant'):
        c=d.get('message',{}).get('content')
        t=c if isinstance(c,str) else ' '.join(x.get('text','') for x in c if isinstance(x,dict) and x.get('type')=='text')
        if t.strip(): print(d['type'].upper(), t[:300], '\n')
" ai-sessions/claude-code/0b24aae2-cdf0-4719-bec5-6c1e2e03dc8f.jsonl | head -100
```

No API key appears in these files; they were searched for the key prefix before committing.

# AI Usage

## Tools

Claude Code (Opus 5) in the desktop app. One session did the planning and kept track of everything, and it started smaller agents in their own git worktrees to do the actual writing. A second session later fixed a query that came out wrong.

The AI wrote pretty much all the code and tests. I didn't type any app code myself. What I did was decide things, write down the rules, read what the agents reported back, and push back when something looked off.

## What you delegated, what you kept

I handed over the writing: tests, implementations, digging through the CSVs, checking pages in the browser, drafting docs.

I kept the thinking:

- **What we build and in what order.** The AI's first move was to hand me a full architecture plan. I stopped it and said we decide scope, build order and test cases first. It had skipped straight to the fun part.
- **How we work.** Build one feature at a time, tests first, keep a progress file so a fresh session can pick up where the last one stopped, and run independent pieces in parallel.
- **Separating who writes tests from who writes code.** This one I pushed hard on. My worry was simple: if the same agent writes both, it writes code that passes its own tests and nothing more. So the test agent and the code agent never saw each other's work, and when a test failed I only passed along "here's the input, here's what should come out, here's what came out".
- **What the messy data actually means.** For example: if a job has no end date, that person still works there. And if someone has two jobs with no end date, the older one probably ended when the newer one started.
- **Product calls,** like whether "AI/ML" in a query should filter people out or just push better matches up.

## Where it was wrong

- **It made "AI/ML" a hard requirement.** I thought "Rust developer with 5+ years experience in AI/ML" should show me Rust people, with the AI/ML ones first. The AI decided all three had to be tagged on the person, and I got exactly one result. I only caught it because I ran the brief's own example queries in the app. We changed the rule: for a query like that, Rust is required and AI/ML just move you up the list. Now it returns 5 people, AI/ML ones on top.
- **It kept telling me things were still to do when they were done.** The AI was updating the progress file with find-and-replace scripts. The formatter had quietly changed the spacing in a table, so the replacements matched nothing and did nothing, and the AI didn't check. The status sat wrong for a while. It's a good reminder that a script that "worked" isn't the same as a change that happened.
- **The formatter ate parts of my specs.** Same formatter, running over the spec docs, squashed the numbered test lists into paragraphs and quietly dropped the spaces inside things like `` ` OR ` ``, which changes what the rule means. The agents were reading those specs. We put the lists back and told the formatter to leave the docs alone.
- **Highlighting looked broken.** On a profile, searching React highlighted nothing, because resumes say "ReactJS" and the code was only matching whole words. That one was thought-provoking in a small way: the AI had matched the spec exactly, and the spec was the thing that was wrong.
- **Agents started from old copies of the work.** They branched off what was pushed to GitHub, not what was on my machine, so early ones were reading outdated specs. They noticed and caught themselves up, but after that I pushed before starting a round.

## What you would not trust it with

- **Deciding what messy data means.** The rules the AI suggested for salaries and dates sounded fine. Then I looked at the actual numbers: 84 of the 92 wildly high "monthly" salaries were from India, so they're rupees or yearly figures, not monthly dollars. And 681 people have more than one job with no end date, which is usually just a promotion nobody closed off. You don't get that from a sensible-sounding guess.
- **Deciding what a good search result looks like.** How much resume meaning should count against keywords, or what belongs in the top 10, needs a person looking at real results.
- **Anything near the API key.** Agents were told never to print the `.env` file. I'd still search the session exports for the key before committing them, which I did.

## Session history

They're in `ai-sessions/`, with a `README.md` in there explaining which file is which, since the names are UUIDs. In short: one planning session, one main build session with its 20 agents, a short follow-up session with 2 more, and a quick check-in. There's also a copy of the main session that got duplicated and released; I deleted it after checking every message in it was already in the main file.

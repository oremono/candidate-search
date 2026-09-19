# 🧪 Case Challenge: Candidate Search App

Welcome! This case is designed to help us understand how you approach building real-world products — from backend modeling to frontend UX, and from structured data handling to intelligent search experiences.

Your task is to build a **Next.js app** that allows users (like recruiters) to search over a library of experienced software engineering candidates.

---

## 🎯 What You're Building

You'll create a web app where users can:

1. **Search through a list of candidates** using standard filters like:
   - Expected salary
   - Years of experience
   - Technical skills
   - Country of residence

2. **Enter natural language queries** to find candidates with more nuanced criteria. For example:
   - "Senior React engineer in Canada under 130k"
   - "Rust developer with 5+ years experience in AI/ML"

3. These queries should:
   - Automatically extract and apply structured filters.
   - Also search across candidate **resumes** for relevant keywords or signals that aren't covered by the filters.

4. **Get the top 10 most relevant candidates** returned as search results, along with:
   - Each candidate's basic info
   - A short explanation of **why** they were matched (e.g. "matched Rust in resume, 6 years experience, asking for $125k").

---

## 📊 What You'll Be Evaluated On

We'll be looking at:

| Category                | What We're Paying Attention To                                      |
| ----------------------- | ------------------------------------------------------------------- |
| **Functionality**       | Does the app support both filter-based and natural language search? |
| **Code Quality**        | Is the code well-organized, clean, and maintainable?                |
| **Use of TypeScript**   | Are types used effectively throughout the app?                      |
| **Database Modeling**   | Is the SQLite integration well-structured and efficient?            |
| **Search Logic**        | Are filtering and semantic search combined meaningfully?            |
| **User Experience**     | Is the interface intuitive and pleasant to use?                     |
| **Result Explanations** | Are the reasons for ranking candidates clear and informative?       |

Bonus points for thoughtful touches like preloading strategies, UI polish, or smart handling of ambiguous queries.

---

## 🚀 Getting Started

1. We'll invite you to a private GitHub repository named `crew-interview-challenge-<your-handle>` in the `crew-recruiting` organization, and send you an OpenAI API key. Accept the GitHub invitation from your email; it expires after 7 days.
2. Clone the repo into its own folder:
   ```bash
   git clone https://github.com/crew-recruiting/crew-interview-challenge-<your-handle>.git
   ```
3. Follow the [README](./README.md): `npm install`, copy `.env.example` to `.env` and paste the key we sent, then `npm run db:seed` and `npm run dev`.
4. Commit and push to `main` as you go. Pushing is submitting; there is no pull request to open.

---

## 🧰 Tools & Setup

- **Framework**: Next.js (App Router preferred)
- **Language**: TypeScript
- **Database**: SQLite (a script is provided to seed candidate data — run it with `npm run db:seed`; see [README.md](./README.md))
- **Search**:
  - Use filters for structured fields.
  - For resume matching, you can use any lightweight embedding model (e.g. OpenAI, Hugging Face, or local options) to power semantic search. An OpenAI client is set up in `src/lib/openai.ts`; put the key we send you in `.env`.

---

## ✅ Guidelines

- Use **TypeScript** end-to-end.
- Use **ESLint** and **Prettier** for linting and formatting.
- Use the provided script to populate the SQLite database.
- You're free to use any UI libraries or components you like (Tailwind, shadcn, etc.).

---

## 🤖 Working With AI

We expect and encourage you to use AI coding tools. How you use them is part of what we evaluate, so please capture your sessions and submit them with your code.

**Keep the capture clean.** We only want the conversations about this assessment, nothing from other projects. The simplest way is to give the assessment its own home:

1. Clone the repo into its own folder and do all assessment work there.
2. Start every AI session from inside that folder (or open that folder as the editor workspace). Most tools scope history to the working directory, so this alone keeps other projects out.
3. Start fresh sessions rather than resuming or continuing older, unrelated ones.
4. Before committing, scan exports for secrets, especially your `OPENAI_API_KEY`, since tools sometimes echo file contents into the transcript.

**How to export, by tool.** Commit the files to the `ai-sessions/` folder in the repo (or `.specstory/history/` if you use SpecStory).

- **Claude Code**: run `claude` from the repo folder. At the end of each session run `/export` and save the file into `ai-sessions/`. Alternatively, copy the raw transcripts: they live in `~/.claude/projects/<folder named after the repo path>/*.jsonl`, and only sessions started inside the repo land there.
- **Cursor**: open the repo root with _File → Open Folder_ so it is its own workspace, not a subfolder of a larger one. Install the **SpecStory** extension, which saves every chat to `.specstory/history/` automatically; if it asks, keep the history in version control. Without SpecStory, use _Export Chat_ from the menu of each chat and save into `ai-sessions/`.
- **GitHub Copilot (VS Code)**: open the repo root as the workspace. In the Chat panel, open the `…` menu and choose _Export Chat…_ for each conversation, saving into `ai-sessions/`. SpecStory also works here.
- **Codex CLI**: run `codex` from the repo folder. Sessions are stored under `~/.codex/sessions/` with timestamps in the filename; copy the ones from your assessment window into `ai-sessions/`.
- **ChatGPT, Claude.ai, or another chat app**: start a new conversation (or project) used only for this assessment. When done, use the share or export option and save the result as Markdown or PDF into `ai-sessions/`.
- **Other tools**: export whatever the tool offers. If it offers nothing, say so in `AI_USAGE.md`.

Then fill in `AI_USAGE.md` in the repo root. A few short questions; a few sentences each is plenty.

Not using AI tools at all is fine. Just say so in `AI_USAGE.md`.

---

## 🌟 Extras (Optional but Impressive)

- Build a candidate profile page with resume highlights.
- Support partial matches or typo-tolerant queries.
- Add query suggestions or keyword highlighting.

---

If anything is unclear or you'd like a clarification during the case, feel free to ask — we're happy to help.

Good luck, and have fun with it!

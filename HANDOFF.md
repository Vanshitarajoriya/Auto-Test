# HANDOFF: read this first (for Claude Code on the user's laptop)

As of 2026-10-20. This file carries everything from the cloud session that built this repo, so a new session does not start from zero.
Tags: **[verified]** = run and seen working; **[reported]** = from docs or the user, not tested; **[unknown]** = nobody has answered it yet.
Where this file and the code disagree, the code wins.

**Reading order:** this file -> `CLAUDE.md` (hard rules) -> `CONTEXT.md` (planning decisions D1..D10, MSG91 facts, lessons) -> `HOSTING.md` (the web server) -> `EXECUTION_PLAN.md` (phased plan) -> `drafts/PROGRESS.md`.

## 1. The user and how to talk to them

- Vishal Nema (vishalnema@viasocket.com), tester at MSG91 / Walkover. Also working with Vanshita (GitHub: Vanshitarajoriya) who owns the repo below.
- Writes **Hinglish** (Hindi in Latin letters). Reply in Hinglish, short, simple, no jargon without a one-line explanation. Say plainly what you could not verify.
- Windows laptop, PowerShell, VS Code. Use PowerShell syntax (`$env:PORT="8080"`), never `PORT=8080 cmd`.
- Wants you to **act**, not ask about every step. Ask only for things that are theirs to decide (secrets, accounts, irreversible actions).
- Audience for the result: their TL and CEO. Constraint: keep AI use low; in-house tools (viaSocket, GTWY, DocStar) where they fit.

## 2. Goal

When a ClickUp card moves to **Ready for QA**, the agent runs that card's mapped tests on the MSG91 **dev** environment and comments the result on the card.
**Humans approve tests, Playwright runs them, plain code decides pass/fail. Zero AI calls in the verdict path** (test SAFE-012 enforces it; `server/` is covered too).
Week 1 is **comment-only**: no ClickUp status moves, no bug cards, no deletes.

## 3. What exists [verified unless tagged]

Repo: https://github.com/Vanshitarajoriya/Auto-Test, branch **`msg91-qa-agent`** (the only branch; never push to `main` without asking). Local copy on the laptop: `C:\Users\vansh\Auto-Test`.

| Part | Notes |
| --- | --- |
| `src/`, `runner/run-card.mjs`, `scripts/`, `config/guard.json`, `mapping.json`, `tests/`, `demo/` | The original QA agent from CONTEXT.md section 6. 14 self-tests pass (`npm run selftest`). |
| `server/index.mjs` | **New.** Plain Node web server, no dependencies, no AI. Reads `PORT` (default 3000), listens on `0.0.0.0`. Runs jobs one at a time (queue, last 50 kept in memory). |
| `HOSTING.md` | Routes, Embarko deploy steps, env vars, limits. |
| `drafts/screens/` | Screenshots of the status page and demo report. |

Server routes (all **public, no secret** by the user's choice; do not add one unless asked):

| Route | What it does |
| --- | --- |
| `GET /` | Status page: config checklist, "Run the demo" button, "Run a ClickUp card" form (task id), recent runs |
| `POST /run` | Body `{"task_id":"<clickup id>"}`. Validates the id, queues `runner/run-card.mjs --task <id> --post`. Adds `--post-status` / `--create-bug` only if env `POST_STATUS` / `CREATE_BUGS` = `true`. Returns 202 |
| `POST /demo` | Runs `demo/run-demo.mjs` (fake MSG91 API + fake ClickUp on localhost; touches nothing real) |
| `GET /runs`, `/runs/<id>`, `/runs/<id>.json` | Job list, one job's log and verdict |
| `GET /demo/report`, `/demo/output/...` | Last demo HTML report (path traversal refused) |
| `GET /health` | JSON health |

Run it: `npm install`, then `$env:PORT="8080"; npm start`, open http://localhost:8080.

**Tested [verified, on Linux in the cloud]:** fresh clone of the GitHub branch -> `npm install` -> server start -> demo via `POST /demo` = "everything behaved as designed" (6/6 cards, 7 unsafe actions blocked, 0 AI calls, 0 `AUTO_TEST_` leftovers). `POST /run` with a bad id is refused; with a valid id and no config it ends **"Blocked: environment"** (intended).
**Not tested:** anything on Windows beyond `npm install` and server start (the user started it on their laptop: `MSG91 QA Agent on http://0.0.0.0:8080`). One Windows bug was found and fixed (`fileURLToPath` for the project path, commit ff42c6a). The user later said "its not working" **without an error message**: ask for the exact PowerShell error and which step failed. Likely causes: an old server still on the port (`EADDRINUSE`; use another `PORT`), wrong folder (no `package.json`), or an old zip copy instead of the GitHub clone.

## 4. Decisions made in this session (on top of CONTEXT.md D1..D10)

| # | Decision | Why |
| --- | --- | --- |
| H1 | Host as a Node web server (`server/`), deployable to **Embarko** (embarko.ai: reads `PORT`, binds `0.0.0.0`, no Dockerfile, builds from source) | User asked to host it on Embarko |
| H2 | **No runner secret.** `/run` and `/demo` are public | User explicitly asked: "remove that runner secret and keep everything public". Known risk: anyone with the URL can queue a run, and a card run comments on that ClickUp card. Dev-only allowlist, test recipients and spend cap still apply. To lock later, put auth back in front of the two POST routes |
| H3 | Local first, **Embarko later** | User: "lets run it on local, not on embarko, i will do that later" |
| H4 | The use case to build with viaSocket: **ClickUp card -> run tests** (not Slack, Gmail, or posting results through viaSocket) | User's answer to the first question |
| H5 | The viaSocket skill file the user uploaded earlier was **Gmail only** (org 16051). The skill to install now is a different one: org **71346**, project **projgzodGHeN** (section 6) | Do not mix them |

## 5. Rules that bind you (from CLAUDE.md, plus this session)

1. DEV only. Never call `control.msg91.com` or any live MSG91 host.
2. Week 1: comment-only on ClickUp. No status moves, no bug cards, no deletes.
3. Everything created is named `AUTO_TEST_` (`taggedName()`), registered for cleanup. Messages only to `TEST_RECIPIENTS`, within the spend cap.
4. Never print, echo, commit or ask the user to paste secrets in chat. Secrets live in `.env` (never committed) or the host's secret settings.
5. Do not invent MSG91 endpoints, parameters or response shapes: read `https://docs.msg91.com/llms.txt` -> each module's `module.json`, or verify on dev.
6. Never claim a result you did not see. Say "against a mock" when it ran against a fake.
7. Commits: branch `msg91-qa-agent`, ask before pushing to `main`, ask before anything irreversible. Do not put model names in commit messages.

### The guard will block you (important)

`.claude/settings.json` registers a PreToolUse hook (`scripts/guard-hook.mjs`) that only lets Claude write under `tests/`, `drafts/`, `specs/`, `demo/tests/`. It **protects** `src/`, `runner/`, **`server/`**, `scripts/`, `config/`, `.claude/`, `.github/`, `mapping.json`, `package.json`, `CLAUDE.md`, `.mcp.json`, `playwright.config*`. There is no bypass variable.
The viaSocket work (section 6) must edit `server/`, `package.json` and add a skill folder, so it is a **[MAINTAINER]** task. When the guard blocks you, do not work around it. Tell the user, who can do one of:
- In VS Code, temporarily remove the `hooks` block from `.claude/settings.json`, do the maintainer work, then restore it with `git checkout .claude/settings.json`; or
- Make the edits by hand from your instructions.
Ask which they prefer before starting.

## 6. What to do next (in order; stop after each step and show the result)

**Step 0: get unstuck.** Ask for the exact error from the user's laptop; reproduce on a fresh `git clone` if needed. Run `npm install`, `npm run selftest` (14 pass), `npm run check`, then start the server and run the demo from the status page.

**Step 1: viaSocket skill.** Download this file **exactly** and save it as `viasocket/SKILL.md` in this project's skills folder (`.claude/skills/viasocket/SKILL.md`; that path is under `.claude/`, so it needs the guard handled, section 5):
`https://flow.viasocket.com/documentation/skill-install.md?org=71346&project=projgzodGHeN`
It is short on purpose: it fetches the full, current skill each time it is used. Do what it says. `VIASOCKET_EMBED_SECRET` should be in `.env` (the file does **not** exist yet; copy `.env.example`); if it is missing, ask the user, and do not echo it. This session could not download the file (network policy), so its contents are **[unknown]**.

**Step 2: build "ClickUp card -> run tests".** Planned shape, to be confirmed against the skill's own instructions (do not guess its endpoints or IDs):
- A "Connect ClickUp" button on the status page (viaSocket connect popup); the user connects once.
- A picker filled with the user's real ClickUp lists (fetch ids with list-options, never hardcode); the user picks the list once.
- A setting for the start status (default "Ready for QA").
- Subscribe to ClickUp's "task status changed" event for that list, delivered to `POST /webhooks/viasocket` on this server.
- On each event: if the new status matches, take the task id and queue the same job `POST /run` queues. Ignore everything else.
- Who supplies each value: org/project ids and embed secret = code (env); event type = code (fixed); ClickUp connection, list, start status = the user, once; task id = the event, every run; tests and verdict = `mapping.json` + Playwright (**no AI per run**).
- A viaSocket `script_id` is a credential: store server-side only, never send it to the browser.
- At the end, report **each line of the skill's "Finished when" list**.
- viaSocket cannot reach `localhost`, so the live trigger only works once the app has a public URL (Embarko, step 4). Until then test by hand with the status page's "Run card" form.

**Step 3: first real card, only after the user says go.**
- Needed in `.env` (ask for each; never guess): `DEV_URL`, `ALLOWED_HOSTS`, `MSG91_AUTHKEY` (dedicated automation account), `TEST_RECIPIENTS`, `CLICKUP_TOKEN`, `STATUS_PASSED`, `STATUS_FAILED`, optional `CLICKUP_BUG_LIST_ID`. **The dev base URL and whether dev is reachable from outside are [unknown]** (CONTEXT.md B1).
- `npm run doctor -- --task 86d38k0vn` shows what the runner would do, without posting. The user's first card is `https://app.clickup.com/t/3687137/86d38k0vn` (task id `86d38k0vn`); its content has **never been read** [unknown]. ClickUp field parsing (Module/Feature dropdown option id vs orderindex) must be verified on one real card.
- The user's ClickUp list link: `https://app.clickup.com/1300450000012291/v/l/14yr2e4t103-336` (workspace 1300450000012291). Different workspace id from the card link above: ask which workspace and list is the real QA one.
- ClickUp official MCP (`https://mcp.clickup.com/mcp`, OAuth) is in `.mcp.json`; the user must run `/mcp` and log in to `clickup`. The guard's ClickUp allow/deny patterns were written without the real tool names; tune them once (unknown tools are denied).

**Step 4: Embarko deploy (the user said later).**
- `npx skills add embarko-ai/skill --skill embarko-deploy -g`, then the skill's `scripts/deploy.sh` in this folder. Anonymous first deploy is **temporary (24 hours)**; the claim link or the emailed token makes it permanent. Report the URL only after the script exits 0; ask for the user's email only after it is live.
- Embarko facts [reported, from the skill]: app is at `<name>.embarko.app`; `.env*` is never uploaded, so set secrets in Embarko; app must read `PORT`, bind `0.0.0.0`, have no Dockerfile; no `window.storage`.
- A redeploy reuses the app name, so the URL stays the same. viaSocket's target would be `https://<app>.embarko.app/webhooks/viasocket` (or `/run`).
- Limits: Embarko probably has no browser, so UI tests (`tests/**/ui/`) stay on GitHub Actions; API tests, canaries and the demo need none. If MSG91 dev is private (VPN/IP allowlist) Embarko cannot reach it; use a self-hosted runner (CONTEXT.md D5).

**Step 5: wrap up.** Commit to `msg91-qa-agent` and push. Show the user what changed (files, one line each), what is verified vs not, and what they can add next: Slack alerts through viaSocket (low wallet, suite broken, Blocked), a read-only Gmail test mailbox for email/OTP checks (D10), status moves and bug cards after the week-1 pilot, nightly `AUTO_TEST_` cleanup, smoke/nightly workflows.

## 7. Environment facts and gotchas

- The cloud session that wrote this could not reach `embarko.ai`, `ship.embarko.ai`, `api.clickup.com`, `flow.viasocket.com`, `flow-api.viasocket.com`, `flow.sokt.io`, `embed.viasocket.com` (its network policy blocked them). The laptop should not have that limit. So **everything involving those hosts is untested**.
- Claude on the laptop was installed with `npm install -g --allow-scripts=@anthropic-ai/claude-code @anthropic-ai/claude-code` (v2.1.303); the first install skipped a postinstall step.
- `npx playwright init-agents` replaces `.mcp.json`: back it up first. `source` does not exist in `/bin/sh` (use `bash -c`). Never `pkill -f` with words from your own command.
- Node `fetch` can hit a stale keep-alive socket after a long Playwright run; network calls already retry (SAFE-013).
- A public Embarko URL shows run history and card names to anyone (H2). Mention this if the user shares it widely.
- Open blockers from `EXECUTION_PLAN.md` section 4 (B1..B11) still apply: dev base URL, real vs simulated messages and wallet, how a test reads an OTP or email, the dedicated dev account, ClickUp Module/Feature fields and statuses, approval to send card text to an AI API.

## 8. Where things are

| What | Where |
| --- | --- |
| Web server | `server/index.mjs` |
| Card runner (verdict rules, no AI) | `runner/run-card.mjs`, `src/results.mjs`, `src/report.mjs` |
| Safety (allowlist, prefix, cap, cleanup) | `src/safety.mjs`, `src/api.mjs`, `src/preflight.mjs` |
| Guard hook rules | `config/guard.json`, `src/guard.mjs`, `scripts/guard-hook.mjs` |
| Module/Feature -> test IDs | `mapping.json` (names are placeholders until aligned with ClickUp) |
| Self-tests / canaries | `tests/_selftest`, `tests/_canary` (protected) |
| Demo (fake API + fake ClickUp) | `demo/`, `npm run demo` |
| Hosting and Embarko | `HOSTING.md` |
| Env var list | `.env.example` |

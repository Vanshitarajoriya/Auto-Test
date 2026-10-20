# RUN_LOCAL: get this app running on the user's Windows laptop (for Claude Code)

You are Claude Code running on the user's Windows laptop (PowerShell, VS Code), in the folder of this repo, branch **`old-runner`**. Your one job right now: **make the demo run on this laptop and prove it.** Nothing else (no Embarko, no viaSocket, no ClickUp, no real MSG91) until the demo works.

Talk to the user in simple **Hinglish**, short. Use PowerShell syntax (`$env:PORT="8080"`, never `PORT=8080 cmd`). Show real command output; never say "it works" without having seen it. Do not read, print or commit `.env` or any secret.

## What this app is
A card-driven QA runner. `npm start` starts a small web server (`server/index.mjs`): a status page, `POST /run {task_id}`, `POST /demo`. The **demo** runs 6 fake ClickUp cards through the real runner (`runner/run-card.mjs`) against a **fake MSG91-style API** and a **fake ClickUp** on localhost, runs safety checks, and writes an HTML report. No accounts or secrets needed. There is **no runner secret**: `/run` and `/demo` are public by the user's choice.

## State of the code
- On Linux in the cloud this exact code ran **end to end**: server start, `POST /demo`, result "Demo: everything behaved as designed" (6/6 cards, 14 self-tests, 24 unique test IDs).
- On this Windows laptop the user got as far as `npm install` and `MSG91 QA Agent on http://0.0.0.0:8080`, then reported "not working" **without an error message**. Treat the cause as unknown.
- Two Windows fixes are already in: (1) `server/index.mjs` builds the project path with `fileURLToPath`; (2) `runner/run-card.mjs`, `scripts/check-library.mjs` and `scripts/doctor.mjs` now run Playwright with `node <cli.js>` instead of `npx` through a shell. The old way made `cmd.exe` read the `|` in `--grep "(DEMO-001|DEMO-002):"` as a pipe, so the tests never ran (a likely reason the demo failed here). Neither fix has been run on Windows yet. Verify both.

## Do this, in order, and show the output of each step

1. **Environment.** `node -v` (need **20 or newer**; if older, tell the user to install Node 20 LTS from nodejs.org and reopen PowerShell), `npm -v`, `git --version`, `git branch --show-current` (must be `old-runner`), `git log --oneline -3`.
2. **Fresh install.** `npm install` (not `npm ci`). If it fails, show the error and fix the cause.
3. **Self-tests.** `npm run selftest` -> expect **14 passed**. Then `npm run check` -> expect "Library check OK: 24 tests, 24 unique IDs".
4. **Start the server** in its own window so it keeps running: `$env:PORT="8080"; npm start`. Expect `MSG91 QA Agent on http://0.0.0.0:8080`.
   - **Open `http://localhost:8080` in the browser, never `http://0.0.0.0:8080`** (Windows browsers cannot open 0.0.0.0; this is a common false "not working").
   - If you see `EADDRINUSE`, another process holds the port: find it with `netstat -ano | findstr :8080`, or use another port (`$env:PORT="8090"`).
   - If Windows Firewall asks about Node, tell the user to click **Allow** (private networks).
5. **Health.** `Invoke-RestMethod http://localhost:8080/health` -> `ok : True`.
6. **Run the demo through the server** (in a second window): `Invoke-RestMethod -Method Post http://localhost:8080/demo`, then poll `Invoke-RestMethod http://localhost:8080/runs` every ~10 s until `status` is `done`. It takes about 2 minutes. Expected `verdict`: **"Demo: everything behaved as designed"**. Read the full log at `http://localhost:8080/runs/1.json` (the `log` field) if it differs.
7. **Report.** Open `http://localhost:8080/demo/report` and tell the user what they should see: 6 cards (QA Passed x2, QA Failed with a bug card, Needs fields, Manual needed, Blocked: environment), safety checks all as designed, 0 AI calls, 0 `AUTO_TEST_` items left.
8. **Also try the CLI path** (no server): `npm run demo`. It prints each card with its verdict and writes `demo/output/demo-report.html`.

## If something fails
Read the real error first; do not guess. Likely suspects, most to least:
- A leftover `node` process from an earlier attempt holding the port or files: close old PowerShell windows or `Get-Process node | Stop-Process` (ask the user first).
- Old Node (< 20), or a corrupted `node_modules`: delete the `node_modules` folder and run `npm install` again.
- Antivirus or Defender locking `test-results`/`results` folders: retry, or exclude the project folder.
- Paths with spaces or very long paths: move the repo to `C:\qa\Auto-Test`.
- A copy of the project from the old zip in `Downloads` instead of this git clone: work only in the git clone.
- Anything Windows-specific in `runner/`, `scripts/`, `demo/run-demo.mjs`, `server/index.mjs`: fix it minimally, re-run steps 3 to 6, and explain the fix in one line. These files are protected from Claude's own edits by `.claude/settings.json`; if the guard blocks you, **tell the user** (they can temporarily remove the `hooks` block from `.claude/settings.json` and restore it with `git checkout .claude/settings.json`). Do not work around the guard.

## Done when
The demo finished with "everything behaved as designed" on **this laptop**, you showed the output, and the user can open `http://localhost:8080` and `/demo/report`. Then commit any fix on `old-runner` (never `main`), push it, and tell the user what was wrong and what you changed.

## Only after the demo works (ask the user first)
Real cards need values the user must provide in `.env` (copy `.env.example`; you never read it): `DEV_URL` (MSG91 DEV base URL, still unknown), `ALLOWED_HOSTS`, `MSG91_AUTHKEY` (automation account), `TEST_RECIPIENTS`, `CLICKUP_TOKEN`, `STATUS_PASSED`, `STATUS_FAILED`. Without them a real card ends **"Blocked: environment"**, which is intended, not a bug. Then: `npm run doctor -- --task <card id>` shows what the runner would do without posting anything. Week 1 is comment-only. Embarko hosting and the viaSocket trigger come later (`HOSTING.md`). Background and decisions: `CONTEXT.md`, `HANDOFF.md`, `CLAUDE.md`.

## Hard rules that always apply
DEV only, never `control.msg91.com` or any live host. Nothing the automation creates is left behind (`AUTO_TEST_` prefix). Messages only to test recipients. No secrets in chat or Git. Ask before anything irreversible.

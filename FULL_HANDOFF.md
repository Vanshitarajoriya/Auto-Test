# FULL HANDOFF: MSG91 QA agent (everything from the cloud session, for the next Claude Code session)

Written 2026-10-20 by the cloud session that built the first version. Read **Part A** (what happened and where things stand) first, then **Part B** (the agent guide: MSG91 facts, testing standard, workflow, safety).
Tags: **[verified]** = seen working; **[reported]** = from the user, a screenshot or a docs page, not tested by the writer; **[memory]** = from general model knowledge, check before use; **[unknown]** = nobody has answered yet.
Where this file and the code disagree, the code wins. Never put secrets in chat, in this file or in Git.

---

# PART A: history and current state

## A1. The user
- Vishal Nema (vishalnema@viasocket.com), tester at MSG91 / Walkover (viaSocket is a sister product at the same company). GitHub repo owner: Vanshitarajoriya.
- Writes **Hinglish**. Reply in Hinglish, short, simple, jargon explained in one line, and say plainly what you could not verify. They get frustrated by long explanations and by being told to do things you could do: act first.
- Windows laptop, PowerShell, VS Code, Chrome. Use PowerShell syntax (`$env:PORT="8080"`), never `PORT=8080 cmd`.
- Goal: automate testing of ClickUp cards (today tested by hand on DEV first, then live) with **proficient** tests, as little manual work as possible, nothing irreversible, nothing hitting live MSG91. Audience: their TL and CEO (the CEO asked for "an agent built with Claude in 30 minutes").
- Latest instruction (2026-10-20): **remove the runner and the long project; build now; Claude agent runs everything; use AI as much as wanted, but testing must be proficient.** This reverses the earlier rule "no AI in the verdict path". The verdict must still come from observed test output, never from a guess.

## A2. What the user uploaded at the start
1. `msg91-qa-agent` zip: the "plan A" project (Playwright + guard hook + deterministic runner + demo). This is the code base that was used.
2. `msg91-qa-automation` zip: a "plan B" variant (Express doorbell server, YAML mapping, notify via viaSocket). Its HANDOFF says the user is "Ajit (viaSocket)" and that **any connection to other apps (ClickUp trigger, Slack alerts) must go through the viaSocket SDK**. It was **not** used or merged. Same author's `mapping.yml`, `src/decide.js` etc. are in that zip only, not in Git.
3. `CONTEXT.md`: the planning briefing (decisions D1..D10, MSG91 facts). Its key content is carried into Part B.
4. Later: a viaSocket **Gmail** skill (org 16051, service id `rowo0bqrhj5g`): Gmail only, so it cannot connect ClickUp. A second, different install link was given: `https://flow.viasocket.com/documentation/skill-install.md?org=71346&project=projgzodGHeN` (org **71346**, project **projgzodGHeN**). It was **never downloaded** (blocked in the cloud session): its content is **[unknown]**.

## A3. What the cloud session did, in order
1. Read the zips and context. Tried to find Embarko's instructions: Embarko (embarko.ai) hosts AI-built apps; deploy is via a skill (`npx skills add embarko-ai/skill --skill embarko-deploy -g`, script `scripts/deploy.sh` -> `https://ship.embarko.ai/apps`), app must read `PORT` and bind `0.0.0.0`, no Dockerfile, anonymous first deploy is temporary (24 h) until claimed. App URL form: `<name>.embarko.app`.
2. Created `/home/user/msg91-qa-agent` (a fresh git repo) from plan A and added `server/index.mjs` (status page, `POST /run`, `POST /demo`). Ran everything locally: 14 self-tests, the demo (6 fake cards, safety checks, 0 AI calls), the server routes. **[verified on Linux]**
3. The cloud session's network policy blocked `embarko.ai`, `ship.embarko.ai`, `api.clickup.com`, `flow.viasocket.com`, `flow-api.viasocket.com`, `flow.sokt.io`, `embed.viasocket.com` and `docs.msg91.com`. So **none of those were ever reached from the cloud session**: ClickUp, viaSocket, Embarko and the MSG91 docs were never read by it.
4. Pushed to GitHub `Vanshitarajoriya/Auto-Test` (the user connected GitHub). The user then installed Claude Code on the laptop (`npm install -g --allow-scripts=@anthropic-ai/claude-code @anthropic-ai/claude-code`, v2.1.303; first account had low API balance, so they logged in with another account).
5. Removed the runner secret by the user's request ("keep everything public").
6. Found and fixed two **Windows** bugs (not yet run on Windows): (a) project path built with `new URL(...).pathname` -> now `fileURLToPath`; (b) Playwright was spawned through `npx` + `cmd.exe`, which read the `|` in `--grep "(A|B):"` as a pipe, so mapped tests never ran -> now `node <playwright cli.js>` with no shell.
7. On request, restructured to the agent-only layout (see A4).

## A4. Git state (GitHub `Vanshitarajoriya/Auto-Test`, last fetched 2026-10-20) [verified]
| Branch | Tip | What it is |
| --- | --- | --- |
| `msg91-qa-agent` | `de0707b` (+ this file) | **Agent-only layout.** No runner, no server, no demo, no mapping, no long plan. Has `CLAUDE.md` (rules), `HANDOFF.md` (agent guide), `.claude/commands/test-card.md` (`/test-card <card>`), safety layer in `src/`, `scripts/guard-hook.mjs`, `scripts/preflight.mjs`, tests `_selftest/_canary/_template/_seed`. **Incomplete, see A6.** |
| `old-runner` | `bd16b60` | The previous design: runner + server + demo + mapping, with both Windows fixes and `RUN_LOCAL.md` (a step-by-step for getting the demo running on the laptop). 14 self-tests and the demo pass on Linux. |
Earlier history on `msg91-qa-agent`: `f96b1b6` (runner secret removed, runner design), `ff42c6a` (Windows path fix), `cb75be5` (screenshots).

## A5. What exists on the laptop and on Embarko (NOT in Git) [reported, via one screenshot]
- On 2026-10-20 the user showed `https://msg91-qa-agent.embarko.app` **live** with a page titled "MSG91 QA Agent", an **"Admin password" sign-in** (the user got "Wrong password") and text along the lines of: *"Cards that reach the chosen status are queued instantly through viaSocket, tested by Claude on your PC against https://test.ms… [truncated], reported back on the card's 'viaSocketQA's Claude Agent Testing' subtask."*
- That app is **not** the one the cloud session wrote (that one had no sign-in and no such text). It was built by the **Claude Code session on the laptop**. Its code was **not pushed to GitHub** (the cloud session's last fetch shows no such commit) and the cloud session never saw it. The admin password is whatever that session set; the cloud session does not know it.
- What the screenshot implies about the design (**confirm with the user and the laptop code; do not assume**): ClickUp card reaches a chosen status -> viaSocket sends it to the Embarko app -> the app queues it -> Claude Code **running on the user's PC** tests it against a DEV host that begins with `https://test.ms` (**probably the MSG91 DEV/test host; exact URL [unknown] until the user confirms**) -> the result is written to a **subtask named "Claude Agent Testing"** on the card in a ClickUp space/list called "viaSocketQA" (assumed from the text).
- That design is sensible: Embarko has no browser, so the real testing runs on the PC; the cloud app is only the queue and status page.

## A6. Pending items (each needs the user's yes first)
1. **Safety files are still the old ones on `msg91-qa-agent`.** `config/guard.json` still limits the agent to writing under `tests/`, `drafts/`, `specs/`, `demo/tests/` and to ClickUp read + comment only. The new rules say the agent may write anywhere except the safety files and may move statuses, create bug cards and subtasks (still never delete, archive, merge or bulk-change). Loosening a guard is the user's call; an automatic safety check refused to let the cloud session do it unasked. When approved: set `writeAllowPrefixes` to `[]`; set `writeDenyPrefixes` and `protectedPaths` to `["src/safety.mjs","src/guard.mjs","src/config.mjs","scripts/guard-hook.mjs","config/",".claude/settings.json","tests/_canary/","tests/_selftest/"]`; in the ClickUp patterns allow `update_?task` and `create_?task` and keep `delete|remove|bulk|merge|archive` denied; make `src/guard.mjs` treat an empty allow list as "allow"; update `SAFE-009`'s expectations.
2. **`SAFE-012` fails** on `msg91-qa-agent` (13 pass, 1 fail) because it scans `runner/` and `server/`, which no longer exist. Delete it (the "no AI in the verdict path" rule is gone by decision), and delete the self-tests of removed code (SAFE-007, 008, 011, 013, 014) plus the unused `src/clickup.mjs`, `mapping.mjs`, `results.mjs`, `report.mjs`. Then `npm run selftest` must pass.
3. **Reconcile the three versions:** (a) `msg91-qa-agent` (agent-only), (b) `old-runner`, (c) the laptop's Embarko app. First step for the next session: ask the user for the laptop folder's state, make sure (c) is committed and pushed to a branch, and decide with the user which one is the base. Do not rebuild what (c) already does.
4. **Security of the public app:** the Embarko URL is public; it has an admin password. Never put that password or any key in Git or chat. A viaSocket-to-app call needs whatever auth (c) uses; check how (c) authenticates viaSocket.

## A7. Not verified anywhere [unknown / untested]
Anything on **Windows** beyond `npm install` and server start; the demo on Windows; real ClickUp (the list `https://app.clickup.com/1300450000012291/v/l/14yr2e4t103-336`, card `86d38k0vn`, and the "viaSocketQA" space were never read by the cloud session); MSG91 DEV (URL, authkey, recipients, wallet); viaSocket (the skill content, flow, org 71346); UI/browser tests; Playwright MCP inside Claude Code; the guard hook inside a real Claude Code session; ClickUp's official MCP tool names (`https://mcp.clickup.com/mcp`, OAuth; the guard's allow/deny patterns were written without them and need one tuning pass).

## A8. Decisions log (cloud session and earlier)
| # | Decision | Status |
| --- | --- | --- |
| D1 (old) | Humans approve tests, plain code decides pass/fail, no AI in the verdict path | **Reversed 2026-10-20** by the user: AI allowed everywhere; verdict still must come from observed output |
| D3 | API tests first (`module.json` per module); browser tests only for screen-only features (dashboard, Hello bots, OTP widget) | Kept |
| D6 | viaSocket = trigger (card moves -> call); GTWY = optional narrow jobs | Kept in spirit; implemented by the laptop session per A5 |
| D7 | Safety in code: DEV-only URL check (live hosts always refused), `AUTO_TEST_` prefix, tagged-only delete, teardown, spend cap, test recipients only, canaries that must fail | Kept |
| D8 | Week 1 comment-only | **Dropped** by the user's "agent does everything"; status moves and bug cards now allowed once the guard is updated (A6.1) |
| H1 | Host on Embarko | Done by the laptop session (A5) |
| H2 | No runner secret | Superseded: the live app has an admin password |
| H3 | Run locally first | Superseded by A5 |

---

# PART B: agent guide (same content as HANDOFF.md on `msg91-qa-agent`)

## 1. What this is now

There is **no runner and no server**. Claude Code is the agent. For a ClickUp card it reads the card, designs the tests, writes Playwright tests, runs them on DEV, decides pass or fail **from the real run output**, and reports on the card. AI is used freely for thinking; **the verdict must always trace to observed evidence**.
Run it with `/test-card <card id or URL>` (`.claude/commands/test-card.md`), or just paste the card and say "test this".
What was removed on purpose: `runner/`, `server/` (web server, doorbell, Embarko hosting), `demo/`, `mapping.json`, the phased plan and old context docs. The "no AI in the verdict path" rule is gone by the user's decision. What stayed: the safety layer (DEV-only URL check, `AUTO_TEST_` helpers, spend cap, test-recipient check, guard hook), because a wrong test must never hit live MSG91.

**PENDING (needs the user's yes, see below):** the safety files are still the OLD ones. `config/guard.json` still limits the agent to writing under `tests/`, `drafts/`, `specs/` and to ClickUp read + comment only; `tests/_selftest/safety.spec.mjs` still has SAFE-012 (fails now, because `runner/` and `server/` are gone) and tests of the old runner/ClickUp code; `src/clickup.mjs`, `mapping.mjs`, `results.mjs`, `report.mjs` are unused leftovers. Until the user approves loosening the guard, the agent can only write tests under `tests/`, and ClickUp status moves or bug cards are blocked by the hook. Ask the user, then: set `writeAllowPrefixes` to `[]` and `writeDenyPrefixes`/`protectedPaths` to the safety-file list in `CLAUDE.md` rule 9, allow `update_task`/`create_task` in the ClickUp patterns (keep delete, archive, merge, bulk denied), make `src/guard.mjs` treat an empty allow list as "allow", drop the obsolete self-tests, delete the leftovers, and run `npm run selftest` (all must pass).

Repo: https://github.com/Vanshitarajoriya/Auto-Test (see Part A4 for branches). Laptop folder: `C:\Users\vansh\Auto-Test`. Windows + PowerShell + VS Code.

## 2. The user

- Vishal Nema (vishalnema@viasocket.com), tester at MSG91 / Walkover; repo owner on GitHub is Vanshitarajoriya.
- Writes **Hinglish**. Reply in Hinglish, short and simple; explain any jargon in one line. Use PowerShell syntax. Say plainly what you could not verify.
- Wants things **built now**, not planned. Act, do not ask about every step. Ask only for what is theirs to decide (secrets, accounts, irreversible actions).
- Their team tests ClickUp cards by hand on DEV first, then live. Goal: automate card testing as far as possible with **proficient** tests, reversible and safe.
- ClickUp: list `https://app.clickup.com/1300450000012291/v/l/14yr2e4t103-336` (workspace 1300450000012291). First card to try: `https://app.clickup.com/t/3687137/86d38k0vn` (id `86d38k0vn`, a different workspace id: ask which is the real QA one). **Neither has ever been read** [unknown]; ClickUp blocked the cloud session. ClickUp's official MCP is in `.mcp.json` (`https://mcp.clickup.com/mcp`, OAuth): the user runs `/mcp` and logs in to `clickup`. Statuses to use: ask the user for the exact names (`QA Passed` / `QA Failed` are the defaults assumed).
- Optional later: viaSocket (their company's automation tool) as a trigger when a card moves to "Ready for QA". They gave an install link: `https://flow.viasocket.com/documentation/skill-install.md?org=71346&project=projgzodGHeN` (not downloaded yet). Not needed to start.

## 3. Setup (laptop)

```powershell
cd C:\Users\vansh\Auto-Test
git pull
npm install
npx playwright install chromium     # only needed for UI tests
copy .env.example .env              # then fill it in (the agent never reads .env)
npm run preflight
claude
```
**Needed in `.env`:** `DEV_URL` [unknown: ask the dev team], `ALLOWED_HOSTS`, `MSG91_AUTHKEY` (a dedicated automation account on DEV), `TEST_RECIPIENTS` (our test number with country code and a test inbox), optional `TEST_EMAIL`/`TEST_PASSWORD` for dashboard tests. Without `DEV_URL` every call is refused: that is intended. Do not guess any of them.

## 4. MSG91 knowledge

### 4.1 Public docs [reported; docs.msg91.com was not reachable from the cloud session, so recount before relying on numbers]
- `https://docs.msg91.com/overview`; machine-readable index `https://docs.msg91.com/llms.txt`; every module has a `module.json` with endpoints, parameters, auth and sample responses. A docs CLI (`docstar-editor`) can expose them as MCP tools.
- About 132 endpoints in 12 modules: WhatsApp 30, RCS 23, Hello 21, Voice 13, Email 11, Segmento 9, SMS 7, OTP 6, OTP Widget 6, Campaign 4, Subaccount 1, OneAPI 1.
- Every module has read-only **Logs** and **Analytics** endpoints: the safest place to start, and the best source of downstream proof ("did it really send?").
- **The docs describe the live server (`control.msg91.com`). Nothing in them describes DEV.** All paths below are relative: they go on `DEV_URL`, never on a live host.
- Hello: only Agent Bot List and Bot Analytics for bots (no create or edit API), so Hello bots are UI-only tests. Subaccount: only "Add Client", **no delete**, so the automation account is created once by hand.
- Docs issues seen (verify before reporting; some may be fixed): Campaign description in llms.txt was placeholder text; Subaccount sample values mixed up; module-page endpoint links pointed to the docs home; API pages render only a menu without JavaScript; two Voice endpoints both named "Voice Logs"; Add Client looked like a GET over `http://` with the parent authkey in the URL (suggestion: POST over HTTPS with the key in a header).

### 4.2 Common API shape [memory: verify per endpoint in `module.json`]
- Auth is usually an **`authkey` header** (some older endpoints take it as a query parameter). Base `https://control.msg91.com/api/v5/...` is the live host; on DEV swap the host for `DEV_URL`.
- Mobile numbers: country code first, no `+`, no spaces (for India `91XXXXXXXXXX`).
- Rough endpoint families, **do not use these paths without checking `module.json`**: SMS via Flow (`POST /api/v5/flow/` with `template_id` and `recipients[]` carrying the template variables); OTP (`POST /api/v5/otp` to send, `GET /api/v5/otp/verify`, `GET /api/v5/otp/retry`); Email (`POST /api/v5/email/send`); WhatsApp outbound messages and templates (`/api/v5/whatsapp/...`); plus Logs and Analytics per module.
- Typical success body carries `"type":"success"`; errors carry `"type":"error"` and a message. Confirm the real shapes on DEV and write them down in a test comment.

### 4.3 India DLT [reported, MSG91 help pages]
TRAI rule: the business registers on an operator's DLT portal (entity, then header/sender ID, then content templates), then maps the entity ID and templates in the MSG91 panel. Only DLT-approved headers and templates deliver. Consequences for tests: SMS tests need an approved sender ID and template on the automation account; a "rejected / not delivered" result can be a DLT problem, not a product bug.

### 4.4 Known product findings (use as regression ideas)
- **WhatsApp authentication templates:** the send form asks for the OTP twice (`body_1` and "Copy code"). The user tested two different values and the message was sent, so nothing validates that they match. Why (Meta treats body and copy button as separate components) is unchecked. Test idea: send with mismatched values and assert the product's behaviour; report it as a finding if it still sends.
- Docs issues in 4.1.
- Product suggestions the team may raise: a sandbox/test mode (test authkey that sends and charges nothing), magic test numbers, a trash bin for deleted templates/contacts/bots, audit log, bot versioning, an official MSG91 MCP connector.

### 4.5 Facts to get from the dev team before real tests [unknown]
DEV base URL and whether it is reachable from outside (VPN or IP allowlist?); whether messages on DEV are real or simulated and who tops up the wallet; how a test reads the OTP or email it triggered (test inbox, an inbox endpoint, a magic number?); the dedicated automation account; ClickUp Module/Feature dropdown names and status names; dashboard login selectors for UI tests.

## 5. Workflow for one card (the agent does all of it)

1. **Preflight.** `npm run preflight` (DEV_URL set and allowlisted, dev reachable). Failure = **Blocked: environment**, never a product failure. Stop and report.
2. **Read the card** (ClickUp tool): description, acceptance criteria, comments, linked docs, Module/Feature. List what must be true. If it is too vague to test, ask the user; do not invent requirements.
3. **Test plan first.** Show a short matrix before coding (see 6.1). Prefer API tests; use UI tests only for screen-only features (dashboard, Hello bots, OTP widget).
4. **Explore DEV** to learn the real request and response shapes (read `module.json` first, then try a harmless read-only call, then the write path). Use the Playwright MCP for UI exploration (the guard blocks `browser_evaluate` and `browser_run_code_*`).
5. **Write the tests** from `tests/_template/TEMPLATE.spec.mjs`: file `tests/<module>/api/<ID>.spec.mjs` (or `/ui/`), import `test`/`expect` from `src/fixtures.mjs` (never from `@playwright/test`), title `ID: plain English`, tags (`@api`/`@ui`, `@risk-high|medium|low`, `@smoke`/`@regression`), owner annotation. IDs: next free number per module prefix (OTP-001, SMS-001, WA-001, EMAIL-001, HELLO-001, VOICE-001, RCS-001...).
6. **Run** `npx playwright test <file>` and show the real output.
7. **Prove each new test can fail:** change one expected value, see it go red, restore it. A test never seen failing does not count.
8. **Judge** with the rules in 6.3 and **report** on the card (format in 7). Move the status and file bug cards only for a clear Pass or Fail.
9. **Commit** on `qa/<card id>`, push the branch, show the user what changed. Leave DEV clean (`AUTO_TEST_` items removed).

## 6. The testing standard (what "proficient" means here)

### 6.1 Design the matrix before writing code
For every feature, consider and then pick: **happy path**; **required-field and wrong-type inputs**; **boundaries** (length, size, limits, empty, max); **invalid and expired state** (wrong OTP, expired OTP, used OTP, wrong template id, unapproved sender); **auth** (missing authkey, wrong authkey, a key without permission); **idempotency and repeat calls** (resend, double submit, retry); **ordering and timing** (OTP expiry, retry counters); **limits and rate limits**; **data variants** (Unicode and Hindi text, long text, special characters, variables in templates, country codes); **side effects and downstream proof**; **cleanup**. Mark what you deliberately skip and why. Risk-rank: money (wallet, billing), delivery and OTP first.

### 6.2 Assertions that mean something
- Assert the **business result**, not just HTTP 200: response fields, then **downstream proof** (the Logs endpoint shows the message, the test inbox received it, the OTP verifies, the template appears in the list).
- Assert negatives precisely (status **and** error type/message), and that a wrong action had **no side effect**.
- Poll with a timeout for async delivery instead of fixed sleeps. Keep tests independent and order-free.
- Budget sends: every send is counted against the cap; prefer one send that you verify deeply over many shallow ones.

### 6.3 Verdict rules (decide only from observed output)
| Outcome | Condition | Card action |
| --- | --- | --- |
| **QA Passed** | every planned test ran and passed, each was seen failing on purpose once, nothing skipped | comment + move to pass status |
| **QA Failed** | at least one assertion on the product's real behaviour failed, reproduced (re-run once; if it passed on retry it is Flaky, see below) | comment with evidence + move to fail status + one bug card per distinct failure |
| **Blocked: environment** | preflight failed, DEV down, wallet empty, missing account or template | comment only; never "Failed" |
| **Inconclusive / needs human** | card too vague, feature screen-only and unreachable, expected value unknown, you are unsure whether a behaviour is a bug | comment only, say exactly what you need |
| **Flaky** | passes only on retry, or differs across 3 runs | report it, quarantine the test, never silently green; do not move to Passed on a flaky core check |
Also: separate **test bug** (your test is wrong) from **product bug**; fix the first, report the second. If a failure might be a spec ambiguity, say so instead of declaring a bug. Never move a card on partial coverage; say what is untested.

### 6.4 Bug card template
Title `[<Module>] <what is wrong>` | Environment (DEV host, date) | Steps to reproduce (exact request or clicks, redacted of secrets) | Expected | Actual (status, body) | Evidence (test ID, run output, log line, trace/screenshot path) | Severity and why | Related card.

## 7. Card comment format
`Result: <QA Passed|QA Failed|Blocked|Inconclusive>` | What I verified | Tests (IDs) and result of each | Evidence (command, key output, run date) | Failed-on-purpose check done: yes/no | Not covered / doubts / manual-only parts | Branch with the tests.

## 8. Safety layer (stays on)
| Rule | Where |
| --- | --- |
| DEV only; live hosts refused even if listed in `ALLOWED_HOSTS` | `assertAllowedUrl` in `src/safety.mjs` (every API call, preflight) + guard hook for the browser and Bash |
| `AUTO_TEST_` prefix, tagged-only delete, teardown after every test | `taggedName`, `safeDelete`, `Cleanup`; `api.deleteTagged` is the only delete |
| Messages only to `TEST_RECIPIENTS`, spend cap | `assertTestRecipient`, `SpendCap` (cap is per worker: keep `WORKERS=1` for sending tests) |
| ClickUp: no delete, archive, merge or bulk change | guard hook (`config/guard.json`) |
| Agent cannot loosen its own limits | guard hook denies edits to the safety files (list in `CLAUDE.md` rule 9) |
| Secrets | `.env` never read or committed (settings deny + hook) |
| Canaries | `tests/_canary` must always FAIL; CI checks it. If a canary passes, the suite or a guard is broken: stop and tell the user |
The hook is a guardrail, not a sandbox (Bash rules are pattern-based). For production run the agent in a container or a restricted OS user.

## 9. Repo map
`CLAUDE.md` rules | `HANDOFF.md` this file | `.claude/commands/test-card.md` the workflow command | `.claude/settings.json` guard hook | `.mcp.json` playwright + clickup | `src/` safety, guarded API client, fixtures, preflight, guard logic | `scripts/guard-hook.mjs`, `scripts/preflight.mjs` | `config/guard.json` | `playwright.config.mjs` (projects: selftest, canary, api, ui, seed) | `tests/_selftest`, `tests/_canary`, `tests/_template`, `tests/_seed` (saves the DEV dashboard login for UI tests: `npm run seed`) | `.github/workflows/ci.yml` safety checks on pull requests.
Commands: `npm run preflight | test | test:api | test:ui | selftest | canary | seed | codegen | report`.

## 10. Lessons learned
Never `pkill -f` with words from your own command. Node `fetch` can hit a stale keep-alive socket after a long run; retry network calls. `npx playwright init-agents` replaces `.mcp.json`. `source` does not exist in `/bin/sh`. Never present a check as verified if it only ran against a fake. Do not invent MSG91 endpoints.

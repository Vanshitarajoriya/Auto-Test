# CONTEXT: MSG91 QA automation (briefing for Claude Code)

As of 2026-10-19. This file carries the whole planning conversation so a new session does not start from zero.
Tags: **[verified]** = run or read during the conversation; **[reported]** = from a web page or a docs read, not tested by us; **[unknown]** = nobody has answered it yet.
Where this file and the code disagree, the code wins. Do not re-open a decision in section 2 unless the user asks.

**Reading order:** `CLAUDE.md` (hard rules) -> this file -> `EXECUTION_PLAN.md` (what to do) -> `drafts/PROGRESS.md` and `drafts/ANSWERS.md` (live state). How-to: `README.md`, `SETUP.md`, `DEMO.md`.

## 1. The user and the goal

- Works in testing at MSG91 (Walkover). The team tests ClickUp cards by hand, always on the **dev** environment first, then on live.
- Wants to **automate card-based testing as much as possible**, cut manual intervention, and possibly build an automation team. Automation must **not disturb existing things**, and every action must be **reversible** (an agent or Playwright may make mistakes).
- Audience: their TL and CEO. The CEO asked for **an agent built with Claude in 30 minutes** (a demo was built for that).
- Stated constraints: **keep AI use as low as possible** ("automation must not equal AI"); **use in-house tools efficiently** (GTWY, viaSocket, DocStar); docs must be simple and crisp; **tell the user before editing shared docs**.
- Style: writes **Hinglish** (Hindi in Latin letters mixed with English) and often asks for "simple language". Reply in the language they write. Keep replies short, explain jargon (they asked what a runner, a pull request, Playwright Codegen, a helper and teardown are), and say plainly what you do not know or could not verify.

## 2. Decisions (and why)

| # | Decision | Why | Rejected or superseded |
| --- | --- | --- | --- |
| D1 | **Humans approve tests, Playwright runs them, plain code decides pass/fail.** Claude only authors drafts (plus optional advisory jobs). Verdict path has 0 AI calls (test SAFE-012). | Deterministic, auditable, cheap, matches the user's constraint | First plan put AI agents in the middle (card reader, test writer, result checker): superseded |
| D2 | **"Author once, run forever"**, three lanes. A: mapped tests exist -> no AI. B: no tests -> Claude drafts -> pull request -> human merges -> becomes lane A. C: failure -> optional triage that cannot change the verdict | AI cost trends to zero for old features | |
| D3 | **API tests first** (module.json per module). Browser tests only for screen-only things: dashboard, Hello bots (docs show no bot create/edit API), OTP widget | Faster, less flaky | |
| D4 | **Claude Code now, Claude Agent SDK later** for an always-on service. Not OpenClaw or Hermes | They are personal-assistant runtimes (memory, self-improvement, chat apps), not QA tools; Playwright's test agents target claude, vscode, copilot, opencode; larger attack surface. They are model-agnostic and could use Claude, so "Claude vs them" is really about the runtime. If open source is mandatory, look at OpenCode first | |
| D5 | **Runner on GitHub Actions**; a self-hosted runner if dev is private | No server to manage | Unknown whether dev is private |
| D6 | **viaSocket** = trigger (card moves -> GitHub `repository_dispatch`). **GTWY** = narrow stateless jobs (Hello bot answer check, failure summaries), advisory only. Authoring stays on Claude Code / Agent SDK (long tool loop) | Use in-house tools where they fit | Whether GTWY can front Claude as a gateway is **[unknown]** |
| D7 | **Safety lives in code, not prompts**: dev-only URL allowlist (live hosts always refused), `AUTO_TEST_` prefix helper, tagged-only delete, teardown, spend cap, test recipients only, pre-flight, canary tests that must fail | The user's reversibility requirement | |
| D8 | **Week 1 is comment-only.** Status moves and bug cards come after the pilot gate | Build trust first | |
| D9 | **The guard stops the agent editing its own guardrails** (`src/`, `runner/`, `scripts/`, `config/`, `.claude/`, `.github/`, `mapping.json`, `CLAUDE.md`, `playwright.config.mjs`, canary and self-tests). Those changes are [MAINTAINER] tasks via pull request | An agent must not loosen its own limits | Never weaken the guard to let the agent do more |
| D10 | **viaSocket Gmail skill** (uploaded by the user, Gmail only): use only as a **read-only test mailbox** for email checks; one dedicated mailbox, connected once by hand; use manual search mode, never "ai" mode; a `script_id` is a credential. ClickUp uses its official MCP, not this skill | Skill is Gmail-specific | Its per-user connect button UI is not needed |

## 3. MSG91 facts

**Public docs** [reported, read 2026-10-19; recount before relying on numbers]
- `https://docs.msg91.com/overview`; machine-readable index `https://docs.msg91.com/llms.txt`; every module has a `module.json` listing endpoints, parameters, auth and sample responses. A docs CLI (`docstar-editor`) can expose them as MCP tools.
- About 132 endpoints in 12 modules: WhatsApp 30, RCS 23, Hello 21, Voice 13, Email 11, Segmento 9, SMS 7, OTP 6, OTP Widget 6, Campaign 4, Subaccount 1, OneAPI 1.
- Every module has read-only Logs and Analytics endpoints (safest place to start).
- Docs describe the **live** server (`control.msg91.com`). Nothing in them describes dev.
- Hello: only Agent Bot List and Bot Analytics for bots (no create or edit). Subaccount: only "Add Client", **no delete**, so the automation account is created once by hand.

**Observations from that read** (verify before reporting; some may be fixed): Campaign description in llms.txt was placeholder text; Subaccount sample values were mixed up; module-page endpoint links pointed to the docs home; API pages render only a menu without JavaScript; two Voice endpoints both named "Voice Logs"; Add Client appeared to be a GET over `http://` with the parent authkey in the URL (security suggestion: POST over HTTPS, key in a header).

**DLT (India)** [reported, MSG91 help pages]: TRAI rule; the business (not MSG91) registers online on an operator's DLT portal: entity -> header (sender ID) -> content templates; then maps the entity ID and templates in the MSG91 panel. Only DLT-approved headers and templates deliver. MSG91 offers paid "Premium DLT Support".

**WhatsApp authentication templates** [user finding, 2026]: the send form asks for the OTP twice (`body_1` and "Copy code"). The user tested two different values and the message was sent, so the form does not validate that they match. Explanation given (Meta treats body and copy button as separate components) was not checked against Meta's docs.

## 4. In-house tools

- **viaSocket**: workflow automation with many integrations; used here for the card trigger and Slack/ClickUp actions. Its Apps API pattern (connect, `list-options`, `runAction`, `subscribeEvent`) is in the uploaded Gmail skill.
- **GTWY (GTWY.AI)**: one API for several AI models; model switching, fallback routing, guardrails, memory, RAG, testcase builder [reported].
- **DocStar**: docs CLI/MCP for the MSG91 API docs [reported].
- ClickUp is the card source; Slack the alarm channel; GitHub the code and runner host.

## 5. Facts about other tools [reported unless marked]

- **Claude Agent SDK** (renamed from Claude Code SDK): the same agent loop and tools as Claude Code, in Python and TypeScript; supports MCP, hooks, skills, subagents; MCP tools need explicit `allowedTools`. With the Agent SDK Claude owns the loop; with the Messages API you do.
- **Claude Code hooks**: configured in `.claude/settings.json` under `hooks.PreToolUse` with a `matcher` on the tool name (MCP tools are `mcp__<server>__<tool>`); the hook gets JSON on stdin; **exit code 2 blocks the call and sends stderr to Claude**. [Our hook follows this; not yet run in a real session.]
- **ClickUp official MCP**: `https://mcp.clickup.com/mcp`, OAuth only; can delete tasks; one guide says it is metered by the day across the workspace (check your plan). Add with `claude mcp add --transport http clickup https://mcp.clickup.com/mcp`.
- **Playwright MCP**: `claude mcp add playwright -- npx -y @playwright/mcp@latest`; accessibility-snapshot based; headed by default; name it explicitly in the first prompt or Claude may use Bash instead; tools such as `browser_run_code_unsafe` run arbitrary code (the guard blocks them).
- **Playwright test agents** (planner, generator, healer; Playwright 1.56+): `npx playwright init-agents --loop=claude` writes `.claude/agents/*` and **replaces `.mcp.json`**. The planner may paraphrase and produce fragile locators: a human reviews.
- **ClickUp REST v2** custom fields: a dropdown's value can be the option id or its `orderindex`; options are in `type_config.options` (`name` for dropdowns, `label` for labels). Our parser handles both. **[verify on one real card]**
- **OpenClaw** (open-source personal agent runtime with a gateway and chat channels) and **Hermes Agent** (Nous Research; self-improving agent): personal-assistant category, both flagged by one source for the "private data + untrusted content + external actions" risk. Both are new (2026).

## 6. What exists in this repo

| Path | Purpose |
| --- | --- |
| `src/` | `config`, `safety` (guards, prefix, cap, cleanup), `api` (guarded client), `fixtures` (import tests from here), `preflight`, `clickup` (REST helpers with retry), `mapping`, `results` (verdict rules), `report` (fixed comment/bug templates), `guard` (hook decisions) |
| `runner/run-card.mjs` | Deterministic card runner: read card -> mapping -> pre-flight -> canary -> Playwright -> verdict -> optional ClickUp post. Exit codes 0 pass, 1 fail/mapping error/suite broken, 2 blocked, 3 needs fields/manual/partial |
| `scripts/` | `guard-hook.mjs`, `doctor.mjs`, `check-library.mjs`, `mock-clickup.mjs` |
| `config/guard.json` | Hook rules (write allow/deny prefixes, protected paths, ClickUp allow/deny patterns) |
| `mapping.json` | Module -> Feature -> test IDs (names are **placeholders** until aligned with ClickUp) |
| `tests/` | `_selftest` (SAFE-001..014), `_canary` (CANARY-001..003, must fail), `_template`, `_seed` (SEED-001 dev login) |
| `demo/` | Fake MSG91-style API, fake ClickUp cards, demo tests (DEMO-001..005, 007), reference answer for DEMO-006, `run-demo.mjs` |
| `.claude/`, `.mcp.json` | Guard hook registration, Playwright agents, MCP servers (playwright, playwright-test, clickup) |
| `.github/` | `workflows/ci.yml` (PR checks), `workflows/qa-card.yml` (card run), CODEOWNERS, PR template |
| `drafts/` | `PROGRESS.md`, `ANSWERS.md`, `DEV_QUESTIONS.md`, `METRICS.md`; agent proposals go here |

Environment variables: `DEV_URL`, `ALLOWED_HOSTS`, `MSG91_AUTHKEY`, `AUTH_HEADER`, `TEST_RECIPIENTS`, `MAX_MESSAGES_PER_RUN`, `WORKERS`, `TEST_EMAIL`, `TEST_PASSWORD`, `LOGIN_PATH` and selector variables, `CLICKUP_TOKEN`, `CLICKUP_MODULE_FIELD`, `CLICKUP_FEATURE_FIELD`, `STATUS_PASSED`, `STATUS_FAILED`, `STATUS_BLOCKED`, `CLICKUP_BUG_LIST_ID`, `CLICKUP_API_BASE` (mock only).

Commands: `npm run selftest | check | doctor | demo | demo:servers | demo:card | seed | codegen | report`.

## 7. Status

**[verified]** (run in a sandbox against fakes and local servers): 14 self-tests; canaries fail as designed; runner paths (pass, fail, flaky, skipped, mapping error, blocked, needs fields, manual needed, partial); a deliberately broken guard produced "Suite broken"; ClickUp posting against a local mock; doctor in six situations; the demo (6/6 cards, safety checks, HTML report) from a clean install; the "Manual needed -> mapped test -> QA Passed with 0 AI -> QA Failed when a bug is injected" storyline using the reference test.

**Not verified anywhere:** live ClickUp, the dev site, MSG91 dev APIs, browser (UI) tests and `npm run seed` (no browser could be installed in the sandbox), GitHub Actions, the guard inside a real Claude Code session, ClickUp's official MCP tool names, a live Claude authoring run.

**Not built yet:** extra pre-flight checks (login, wallet, sender ID), nightly `AUTO_TEST_` cleanup, module.json contract checks, smoke and nightly regression workflows, viaSocket flow, GTWY agents, always-on Agent SDK service, metrics collection, production monitoring, real MSG91 tests.

## 8. Findings and ideas to keep for the pitch

- Docs issues and the security suggestion in section 3; WhatsApp auth-template copy-code validation gap.
- Product suggestions: a **sandbox / test mode** (test authkey that sends nothing and charges nothing; top pick), magic test numbers, trash bin for deleted templates/contacts/bots, audit log, bot versioning, template-rejection predictor, delivery-speed dashboard, webhook tester, an official MSG91 MCP connector.
- Optional add-ons: OTP phone farm, delivery-speed leaderboard, webhook catcher, price checker, edge-case data generator, customer "twin" bots and bot-vs-bot tests (AI, advisory only).
- The user's ClickUp card to try first: `https://app.clickup.com/t/3687137/86d38k0vn` (task id `86d38k0vn`). **Its content has never been read** (ClickUp blocks automated access).

## 9. Blockers and open questions

Full table in `EXECUTION_PLAN.md` section 4 (B1..B11). The four that stop real tests: dev base URL and reachability from GitHub Actions; real or simulated messages and wallet top-up; how a test reads the OTP or email it triggered; the dedicated automation account on dev. Also open: ClickUp Module/Feature fields and statuses, approval to use Claude and to send card text to Anthropic's API, whether open source is mandatory, dev login selectors.

## 10. Lessons learned (do not repeat)

- Never run `pkill -f "<words that appear in your own command>"`: it killed the shell. Start background processes with `&`, keep the PID, `kill` that PID.
- Node `fetch` can reuse a keep-alive socket the server already closed after a long Playwright run ("fetch failed"). Network calls retry (`src/clickup.mjs`, `demo/run-demo.mjs`). Test SAFE-013 covers it.
- `npx playwright init-agents` replaces `.mcp.json`: back it up first.
- `source` does not exist in `/bin/sh`: use `bash -c`. Quote env values that contain spaces.
- A test copied from `demo/solutions/` needs the import path of its destination.
- Leftover files from an experiment contaminated a demo run; the demo's self-check caught it. Restore state after experiments.
- Never present a check as verified if it only ran against a fake. Say "against a mock".
- Do not invent MSG91 endpoints, parameters or response shapes: read module.json or verify on dev. The demo API is fake and says so.

## 11. Glossary

**Runner**: the program that runs the mapped tests and decides the verdict (GitHub Actions or a VM). **Codegen**: Playwright's recorder that writes a first draft of a test. **Pull request (PR)**: a request to merge a change; a second person reviews first. **Pre-flight**: checks before a run; failure means "Blocked: environment", never "Failed". **Teardown**: cleanup that deletes what a test created, even if the test failed. **AUTO_TEST_**: the prefix forced on everything automation creates. **Page objects / data-testid**: ways to find screen elements that survive UI changes. **Canary**: a test written to fail; if it passes the suite is broken. **Flaky**: passes only on retry; flagged and quarantined, never silently green. **Lane A/B/C**: see D2. **DLT**: India's sender/template registry.

## 12. Documents and links

- Claude Docs made earlier (private; Claude Code may not be able to open them): refined plan and pitch `https://claude.ai/code/artifact/805646c9-d258-41f9-bfbb-ce72dd616ea7`; pitch ideas and suggestions `.../09662a81-912c-491a-8918-e5880f66acf7`; the first plan with AI in the middle (superseded) `.../708a2a68-997e-4511-b44e-642c99cef85b`.
- MSG91: `https://docs.msg91.com/overview`, `https://docs.msg91.com/llms.txt`, `https://msg91.com/help/dlt-registration-in-india`.
- Anthropic: `https://platform.claude.com/docs/en/agent-sdk`, `https://docs.anthropic.com/en/docs/claude-code/hooks`.
- ClickUp MCP: `https://mcp.clickup.com/mcp`; ClickUp custom fields: `https://developer.clickup.com/docs/customfields`.
- Playwright MCP and test agents: search "@playwright/mcp" and "Playwright init-agents".

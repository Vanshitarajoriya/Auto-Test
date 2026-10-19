# MSG91 QA agent

Card-driven test automation. **Humans approve tests, Playwright runs them, plain code decides pass or fail.**
Claude (Claude Code / Agent SDK) only *authors drafts* for cards that have no tests yet. It never sets a verdict.

```
ClickUp card -> "Ready for QA"
  -> viaSocket (repository_dispatch) -> GitHub Actions -> runner/run-card.mjs
       read Module + Feature -> mapping.json -> pre-flight -> canary -> Playwright -> rules -> comment/status on the card
  no tests mapped? -> "Manual needed" -> Claude drafts tests -> pull request -> human merges -> next time it runs with zero AI
```

## Background

**[CONTEXT.md](CONTEXT.md)** is the briefing for a new Claude Code session: the user's goal, every decision with its reason, MSG91 and tool facts, what is verified, lessons learned.

## The whole plan

**[EXECUTION_PLAN.md](EXECUTION_PLAN.md)** is the complete phased plan, written for Claude Code and the people supervising it: blockers, who does what, every task with a "done when" check, and a kickoff prompt. Progress is tracked in `drafts/PROGRESS.md`.

## First day

**[SETUP.md](SETUP.md)** walks through install, ClickUp fields, Claude and dev login. `npm run doctor` checks each step and prints what to fix first; `npm run doctor -- --task <card id>` also reads a real card and shows what the runner would do with it.

## Hosting

**[HOSTING.md](HOSTING.md)**: `npm start` runs a small web server (status page, `POST /run` doorbell for viaSocket, demo button). Deploys to Embarko.

## Try it first: the demo

`npm run demo` runs six cards, the safety checks and a visual report against a fake API and fake ClickUp, with no accounts needed. Presenter script and the optional live Claude step: **[DEMO.md](DEMO.md)**.

## What is verified in this package

| Part | Status |
| --- | --- |
| Safety core (prefix, tagged delete, URL allowlist, spend cap, recipients, teardown) | Tested: self-tests SAFE-001..006, all pass |
| Card -> test mapping, ClickUp field parsing (option id / orderindex / name / multi / text) | Tested on fixtures that follow ClickUp's documented shape |
| Verdict rules (pass / fail / flaky / skipped / missing) and canary health | Tested, including a deliberately broken guard: the runner returned "Suite broken" and trusted nothing |
| Runner exit paths: pass, fail, flaky, skipped, mapping error, blocked, needs fields, manual needed, partial | Run end to end |
| ClickUp posting (comment, status move, bug cards) | Tested against a LOCAL MOCK only (`scripts/mock-clickup.mjs`). The demo found and fixed a real bug: a stale keep-alive connection after a long run made the final post fail; calls now retry (test SAFE-013) |
| `npm run doctor` (config, dev, ClickUp token, card fields, status names, mapping name diff, Claude guard) | Run against the local mock in six situations; not yet against real ClickUp |
| Demo (`npm run demo`) and the Manual needed -> mapped -> QA Passed storyline | Run end to end, including a bug injected into the fake API |
| Claude guard hook (blocks live URLs, unsafe ClickUp tools, writes outside tests/, edits to guardrails, .env, main pushes) | Tested for the decision logic and the exit-code contract; not yet run inside a real Claude Code session |
| `no AI in the verdict path` | Enforced by test SAFE-012 (runner/ and src/ import no AI SDK) |
| **Not tested here** | `npm run seed` (dev login: needs a browser and your selectors), live ClickUp, your dev site, MSG91 dev APIs, browser (UI) tests, GitHub Actions, the Playwright agents inside Claude Code. My sandbox could reach none of them. |

## Quick start (about 10 minutes)

```bash
npm ci
cp .env.example .env            # fill DEV_URL, ALLOWED_HOSTS, MSG91_AUTHKEY, TEST_RECIPIENTS ...
npm run selftest                # 14 guardrail tests must pass
npm run check                   # IDs unique, mapping.json consistent
npx playwright install chromium # only needed for UI tests
node runner/run-card.mjs --module Platform --feature Safety --skip-network-checks   # offline demo: QA Passed
```

Try ClickUp posting safely first: `npm run mock-clickup &` then
`CLICKUP_API_BASE=http://localhost:4010/api/v2 CLICKUP_TOKEN=x node runner/run-card.mjs --task 123 --post-status --skip-network-checks`

## Demo with Claude (the 30-minute CEO demo)

1. `npm install -g @anthropic-ai/claude-code`, then `claude` in this folder. `.mcp.json`, `CLAUDE.md` and the guard hook load automatically.
2. Run `/mcp`: log in to **clickup** (OAuth), confirm **playwright** is connected. Run `/hooks` to confirm the guard is active.
3. Run `/mcp` once and compare the ClickUp tool names with `config/guard.json` (`clickup.allow` / `clickup.deny`). Unknown tools are **denied by default**, so tune the patterns until read + comment work.
4. Log in to DEV in the Playwright browser yourself (no password in a prompt), then:
   > Use the ClickUp tool to read task `<id>`. Follow CLAUDE.md. Explore the feature on DEV with playwright mcp, write the tests, run them, prove they can fail, and show me the draft mapping. Do not comment on ClickUp until I say so.
5. Merge the pull request, then run `node runner/run-card.mjs --task <id> --post`. The second run uses no AI.

Optional: `.claude/agents/` holds Playwright's planner, generator and healer. They need a one-time seed: fill in `tests/_seed/seed.spec.mjs` (dev login).
Note: the guard blocks `browser_evaluate` and `browser_run_code_unsafe` (they bypass the URL check). Relax `blockedBrowserTools` in `config/guard.json` only if the agents need them.

## Wire-up checklist

- [ ] ClickUp: add dropdown fields **Module** and **Feature** (names configurable). Put the same option names in `mapping.json`.
- [ ] ClickUp: personal API token -> repo secret `CLICKUP_TOKEN`. Statuses -> repo variables `STATUS_PASSED`, `STATUS_FAILED`.
- [ ] Repo secrets: `DEV_URL`, `ALLOWED_HOSTS` (set explicitly), `MSG91_AUTHKEY` (dedicated automation account), `TEST_RECIPIENTS`, `TEST_EMAIL`, `TEST_PASSWORD`.
- [ ] viaSocket: when a card moves to "Ready for QA", call GitHub:
  `POST https://api.github.com/repos/<owner>/<repo>/dispatches` with `{"event_type":"qa-card","client_payload":{"task_id":"<id>"}}`
  using a token allowed to create dispatch events (fine-grained: Contents write; check GitHub docs).
- [ ] Branch protection on `main` + "Require review from Code Owners" (edit `.github/CODEOWNERS`). This is what really stops anyone, human or agent, from changing the guardrails.
- [ ] Week 1 stays comment-only. Later set repo variables `POST_STATUS=true`, `CREATE_BUGS=true`.
- [ ] Add pre-flight checks (login, wallet balance, sender ID) to `src/preflight.mjs` `extraChecks` once the dev endpoints are known.
- [ ] Nightly cleanup of leftover `AUTO_TEST_` items: needs the real delete endpoints, so it is not written yet.
- [ ] Add `data-testid` to new dashboard buttons (ask developers).

## Adding a test

Copy `tests/_template/TEMPLATE.spec.mjs` to `tests/<module>/api/` or `tests/<module>/ui/`. Reviewers check:
title starts with `ID:` | asserts the real result | uses `api`, `cleanup`, `taggedName` | was shown failing once | `mapping.json` updated in the same PR.
CI (`.github/workflows/ci.yml`) runs the self-tests, requires every canary to fail, and checks IDs and mapping on every pull request.

## Where each guardrail lives

| Rule | Enforced by |
| --- | --- |
| Dev only | `assertAllowedUrl` (every API call, pre-flight) + guard hook for the browser; live hosts are refused even if allowlisted |
| AUTO_TEST_ prefix, tagged-only delete, teardown | `taggedName`, `safeDelete`, `Cleanup` in `src/safety.mjs`; `api.deleteTagged` is the only delete |
| Messages only to test recipients, spend cap | `assertTestRecipient`, `SpendCap` (cap is per worker: keep `WORKERS=1` for sending tests) |
| ClickUp read + comment only (agent) | guard hook allowlist; the runner posts separately and only with `--post` |
| Agent cannot edit its guardrails | guard hook (path rules) + CODEOWNERS + branch protection |
| False passes | one failing run before approval (PR rule), canaries, one retry then a "flaky" flag |
| Secrets | `.env` never committed or read by the agent; CI uses repository secrets |
| Audit trail | `results/agent-audit.log` (tool name + decision, no tool inputs) and `results/*.json` per run |

## Known limits

- The hook is a **guardrail, not a sandbox**: the Bash rules are pattern-based. For production, run the agent in a container or a restricted OS user.
- ClickUp's official MCP tool names were not available to me, so the allow/deny patterns need one tuning pass. Unknown tools are denied.
- ClickUp's REST responses were parsed to the documented shape only: verify on one real card.
- `mapping.json` feature names are placeholders until aligned with your ClickUp dropdowns.
- Self-test tests under `tests/_selftest` and `tests/_canary` are protected from the agent and need a code owner to change.

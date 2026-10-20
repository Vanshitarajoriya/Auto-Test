# MSG91 QA agent

Claude Code is the agent. Give it a ClickUp card; it designs the tests, writes and runs Playwright tests on **DEV**, decides pass or fail from the real run output, and reports on the card.

```powershell
npm install
copy .env.example .env      # fill in DEV_URL, MSG91_AUTHKEY, TEST_RECIPIENTS ...
npm run preflight           # is DEV fit to test?
claude
/test-card <ClickUp card id or URL>
```

- **Start here:** [HANDOFF.md](HANDOFF.md) (MSG91 facts, testing standard, workflow) and [CLAUDE.md](CLAUDE.md) (hard rules).
- Safety stays on: DEV-only URL check, `AUTO_TEST_` naming and cleanup, spend cap, test recipients only, guard hook. Canaries (`npm run canary`) must always fail.
- No runner, no server: the agent does the whole job.

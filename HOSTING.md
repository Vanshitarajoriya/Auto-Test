# Hosting (Embarko)

`npm start` runs `server/index.mjs`: a small web server around the same runner. It adds no AI and changes no verdict rules.

| Route | What it does |
| --- | --- |
| `GET /` | Status page: config check, recent runs, buttons for the demo and a card run |
| `POST /run` | viaSocket doorbell. Header `x-runner-secret`, body `{"task_id":"<clickup id>"}`. Answers 202 and queues the card |
| `POST /demo` | Runs `demo/run-demo.mjs` (fake API and fake ClickUp, nothing real is touched) |
| `GET /runs/<id>` | One run: status, verdict, full log (`/runs/<id>.json` for machines) |
| `GET /demo/report` | The last demo report |
| `GET /health` | JSON health |

Jobs run one at a time, so two cards never share the spend cap or the automation account. Run history is kept in memory (last 50) and is lost on restart; the evidence lives in the ClickUp comment.

## Deploy

Embarko builds from source (no Dockerfile). The app reads `PORT` and listens on `0.0.0.0`.

```bash
npx skills add embarko-ai/skill --skill embarko-deploy -g   # once
DEPLOY_TOKEN=<your token> ./scripts/deploy.sh .             # from the embarko skill folder; prints the live URL
```

Without `DEPLOY_TOKEN` the first deploy is **temporary (24 hours)**. Open the printed "Keep it" link to keep it.

Then set these as **secrets on Embarko** (not in Git; `.env` is never uploaded):

| Variable | Needed for |
| --- | --- |
| `RUNNER_SECRET` | Any POST. Without it, `/run` and `/demo` are disabled |
| `DEV_URL`, `ALLOWED_HOSTS`, `MSG91_AUTHKEY`, `TEST_RECIPIENTS` | Real card runs. Without them pre-flight says "Blocked: environment" (by design) |
| `CLICKUP_TOKEN`, `STATUS_PASSED`, `STATUS_FAILED`, `CLICKUP_BUG_LIST_ID` | Reading cards and posting results |
| `POST_STATUS`, `CREATE_BUGS` | Leave `false` in week 1 (comment-only) |

## viaSocket

When a card moves to "Ready for QA": HTTP request `POST https://<app>.embarko.app/run`, header `x-runner-secret: <RUNNER_SECRET>`, JSON body `{"task_id":"<task id>"}`.
This replaces GitHub `repository_dispatch` if you host here. The GitHub workflow still works for anyone who prefers Actions.

## Limits (check before relying on it)

- **Dev must be reachable from Embarko's servers.** If MSG91 dev is private (VPN or IP allowlist), use a self-hosted runner instead (decision D5).
- **No browser on the host.** API tests, canaries and the demo need none. UI tests (`tests/**/ui/`) need Chromium, which Embarko's automatic build may not provide: run those on GitHub Actions.
- The URL is public. Only the status page and reports are readable without the secret. Card names and verdicts show on the status page, so do not use this for confidential cards without adding login.
- Not yet verified on Embarko itself; verified locally (`PORT=8080 RUNNER_SECRET=x npm start`).

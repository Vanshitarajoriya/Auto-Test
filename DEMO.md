# Demo guide

A self-contained demo: a **fake MSG91-style API** and a **fake ClickUp** run on your laptop. The runner, mapping, pre-flight, canaries, verdict rules and Claude guard are the real ones. Nothing real is touched.

```bash
npm ci
npm run selftest      # 14 guardrail tests pass
```

## Part 1: the automatic demo (about 1.5 minutes of runtime)

```bash
npm run demo              # add --pause to stop after each card while you talk
open demo/output/demo-report.html     # or open it by double-clicking
```

| Card | What you see | What to say |
| --- | --- | --- |
| 1. `demo-send` | QA Passed, 3 tests, card moved | "The card carries two dropdowns, Module and Feature. A file maps them to tests. This card has two features, so both sets ran. One test created a template named `AUTO_TEST_...` and deleted it again." |
| 2. `demo-verify-ok` | QA Passed | "Correct OTP verifies, wrong and expired ones are rejected. Each check proves the real result, not just 'no error'." |
| 3. `demo-verify-bug` | **QA Failed**, bug card created | "We switched on a bug in the fake API: it now accepts wrong OTPs. The same tests caught it, moved the card to QA Failed and filed a bug card from a fixed template. No AI judged this." |
| 4. `demo-no-fields` | Needs fields | "No Module or Feature on the card, so it asks for them instead of guessing." |
| 5. `demo-resend` | Manual needed | "Nobody has automated this yet. This is where Claude helps (Part 2)." |
| 6. `demo-dev-down` | Blocked: environment | "Dev is down. The card says Blocked, not Failed, so nobody chases a false bug." |

Then the **safety checks**: the runner refuses the live host even if someone allowlists it, and the guard stops Claude from opening live, editing its own guardrails, deleting ClickUp tasks, reading `.env` or pushing to main. The final lines show **0 AI calls** in the verdict path and **0 AUTO_TEST_ items left behind**.

## Part 2 (optional, live): Claude authors tests for the Manual-needed card (8 to 10 minutes)

Terminal 1:
```bash
npm run demo:servers
```
Terminal 2:
```bash
set -a; source demo/demo.env; set +a
claude
```
Paste this prompt (the card text is pasted, so no ClickUp login is needed; ignore a "clickup needs auth" notice):

> Card (pasted, do not fetch it): "OTP: resending must invalidate the previous OTP". Module OTP, Feature Resend. Follow CLAUDE.md. The API is documented in demo/API.md and runs on DEV_URL. Write ONE test as demo/tests/otp/demo-resend.spec.mjs with ID DEMO-006, run it with `npx playwright test demo/tests/otp/demo-resend.spec.mjs`, prove it can fail, and propose the mapping in drafts/mapping-demo-resend.json. Do not edit anything else.

Then play the human:

1. **Review** the test Claude wrote. It must assert the real result (old OTP rejected, new OTP accepted).
2. **Approve** (this stands in for the pull request): in `demo/mapping.demo.json` set `"Resend": ["DEMO-006"]`.
3. **Run it with no AI:** `npm run demo:card -- --task demo-resend --post-status` shows QA Passed and "AI calls in the verdict path: 0".
4. **Prove it catches bugs:**
   ```bash
   curl -s -X POST localhost:4020/demo/admin/bug -H "x-demo-admin: demo-admin" -H "content-type: application/json" -d '{"name":"wrong-otp-accepted"}'
   npm run demo:card -- --task demo-resend
   ```
5. **Reset:** delete `demo/tests/otp/demo-resend.spec.mjs` and set `"Resend": []` again.

Message: **author once, run forever.** AI wrote the test once; every run after that is plain code.

If Claude struggles live, copy `demo/solutions/DEMO-006.reference.spec.mjs` to `demo/tests/otp/demo-resend.spec.mjs` and continue from step 2.

## What is real and what is fake

| Real | Fake |
| --- | --- |
| Runner, mapping lookup, pre-flight, canaries, verdict rules | The MSG91-style API (invented endpoints, see `demo/API.md`) |
| Safety helpers (AUTO_TEST_ prefix, tagged delete, teardown, spend cap) | ClickUp (a local mock that follows its documented task shape) |
| Claude guard hook and its decisions | The "test phone" (an inbox endpoint on the fake API) |
| Playwright running the tests | |

Not shown: browser (UI) tests, real ClickUp, real MSG91 dev. Those come after the dev questions in `README.md` are answered. For UI tests install a browser first: `npx playwright install chromium`.

## Likely questions

- **Does AI decide pass or fail?** No. Test SAFE-012 fails if any AI SDK is imported in the verdict path, and every result prints the AI call count.
- **What if a test is wrong and always passes?** Pull-request review, a "show it failing once" rule, canary tests that must fail, and a human spot-check of passed cards in month one.
- **What stops the AI doing damage?** Code-level guards (see the safety checks), a protected-files list, and branch protection with code owners. The hook is a guardrail, not a sandbox: for production run the agent in a container.
- **Cost?** Claude is used only for cards with no tests yet, and its output becomes a plain test file. Get real numbers from your usage after a pilot rather than from estimates.

## Tidy up

`demo/tests/` is writable by the agent so Part 2 works. Remove `demo/tests/` from `writeAllowPrefixes` in `config/guard.json` when you move to real dev.

# First-day setup

Run `npm run doctor` after every step. It checks this machine, your config, dev, ClickUp and the Claude guard, and ends with **"Fix this first"**.

## Step 0: send the dev questions (nothing else can finish without them)

Dev base URL and whether GitHub Actions can reach it | real or simulated messages on dev | how to add wallet credit | how a test reads the OTP or email it triggered. `npm run doctor` prints these under section 6 until you remove them from `scripts/doctor.mjs`.

## Step 1: install and self-test (5 minutes)

```bash
npm ci
cp .env.example .env        # fill what you know; leave the rest
npm run selftest            # 14 guardrail tests must pass
npm run doctor
```

## Step 2: ClickUp (20 minutes)

1. **Create two custom fields** where your QA cards live (the list, folder or space, so every card gets them). Check ClickUp's help if the menu names differ from these:
   - **Module**: Dropdown. Options = the top-level names in `mapping.json` (OTP, SMS, WhatsApp, Email, Voice, RCS, Hello, Segmento, Campaign, OTP Widget, Dashboard). Edit `mapping.json` instead if your names differ.
   - **Feature**: Labels (multi-select) or Dropdown, one option per feature name in `mapping.json`. A feature name that exists under two modules (for example "Send") appears once; the card's Module decides. A plain text field such as "Send, Verify" also works.
2. **Statuses**: the list needs statuses named exactly like `STATUS_PASSED` and `STATUS_FAILED` (defaults "QA Passed" and "QA Failed"). For Blocked cards add a status and set `STATUS_BLOCKED`.
3. **API token**: create a personal API token in your ClickUp settings and put it in `.env` as `CLICKUP_TOKEN`.
4. **Check your real card.** The id is the last part of its URL, for example `86d38k0vn`:
   ```bash
   npm run doctor -- --task 86d38k0vn
   ```
   Pick Module and Feature on the card and run it again. Success looks like either "N test(s) would run" or "no tests mapped yet" (expected for a new card). Name mismatches between ClickUp and `mapping.json` are listed by name.

## Step 3: Claude agent (15 minutes)

```bash
npm install -g @anthropic-ai/claude-code
claude
```
Inside `claude`: `/mcp` (log in to **clickup**), `/hooks` (the guard hook is listed), then compare the ClickUp tool names with `config/guard.json`. Unknown tools are denied until you add them to `clickup.allow`. Then run the demo prompt from `README.md` on your card. Week 1: comment only, no status moves.

## Step 4: dev login for UI tests (10 minutes)

Fill `TEST_EMAIL`, `TEST_PASSWORD` and the selector variables in `.env`, then:
```bash
npx playwright install chromium
npm run seed           # logs in as the automation account, saves .auth/state.json
```
If a selector is wrong, find the right one with `npm run codegen -- <dev login URL>` and put it in `.env`. This step was written without a browser available, so expect to adjust selectors once.

## Step 5: GitHub and viaSocket

Secrets, the viaSocket trigger, branch protection and CODEOWNERS are in the **Wire-up checklist** in `README.md`.

## Then

With the dev answers in hand, real API tests can be written from `tests/_template/TEMPLATE.spec.mjs` using the module.json for each MSG91 module.

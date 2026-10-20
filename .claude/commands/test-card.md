---
description: Test one ClickUp card end to end on DEV (read, plan, write, run, judge, report)
argument-hint: <ClickUp card id or URL>
---
Test this ClickUp card: $ARGUMENTS

Follow `HANDOFF.md` section 5 exactly:
1. Run `npm run preflight`. If it fails, report **Blocked: environment** and stop.
2. Read the card with the ClickUp tool. Summarise what must be true (acceptance criteria, edge cases, error messages). If the card is too vague to test, ask me.
3. Write the test plan (matrix) and show it before writing code.
4. Write the tests under `tests/<module>/api/` (or `/ui/` for screen-only features), run them, and show the real output.
5. Prove each new test can fail (break one expected value, see it go red, restore it).
6. Judge the verdict from the observed results only, using the rules in `HANDOFF.md` section 6.
7. Comment on the card in the standard format. Move the status and file bug cards only for a clear Pass or Fail.
8. Commit on branch `qa/<card id>` and show me what changed.

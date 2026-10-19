# Progress (the agent updates this after every task; evidence = command and real result)

Last updated: (date) by (agent or person)

## Phase 0
- [ ] P0.1 [HUMAN] Dev questions sent
- [ ] P0.2 [HUMAN] Claude approved (API key, data policy)
- [ ] P0.3 [AGENT] Baseline: 14 self-tests, check, doctor
- [ ] P0.4 [HUMAN] Metrics baseline started

## Phase 1 (gate G1: account ready, doctor shows 0 to fix, 10 cards in the new format)
- [ ] F1.1 [DEV-TEAM] Automation account on dev
- [ ] F1.2 [HUMAN] ClickUp fields, statuses, token
- [ ] F1.3 [MAINTAINER] mapping.json aligned
- [ ] F1.4 [MAINTAINER] Guard confirmed in Claude Code, ClickUp tool names tuned
- [ ] F1.5 [HUMAN] .env and seed login
- [ ] F1.6 [AGENT, MAINTAINER] Pre-flight extra checks
- [ ] F1.7 [MAINTAINER] GitHub secrets, CODEOWNERS, branch protection, CI green
- [ ] F1.8 [MAINTAINER] viaSocket trigger (comment-only)
- [ ] F1.9 [AGENT] Three real cards dry-run
- [ ] F1.10 [HUMAN] 10 cards in the new format
- [ ] G1 passed

## Phase 2: OTP pilot (gate G2: 10 real cards without help, 15+ tests merged)
- [ ] O2.1 [AGENT] OTP API notes verified
- [ ] O2.2 [AGENT] Test plan approved
- [ ] O2.3 [AGENT] Tests written in batches of 5 (batches: )
- [ ] O2.4 [HUMAN, MAINTAINER] Reviewed, merged, mapped
- [ ] O2.5 [AGENT] Real OTP cards run (comment only)
- [ ] O2.6 [HUMAN] Spot-checks done, false alarms logged
- [ ] O2.7 [MAINTAINER] Status moves enabled
- [ ] G2 passed

## Phase 3: expand (gate G3: smoke and regression green, nightly under 15 minutes)
- [ ] SMS  - [ ] WhatsApp  - [ ] Email  - [ ] Voice  - [ ] Dashboard
- [ ] E3.2 Smoke and nightly workflows
- [ ] E3.3 AUTO_TEST_ cleanup job
- [ ] E3.4 Contract checks
- [ ] E3.5 data-testid requests sent
- [ ] E3.6 Flaky report
- [ ] E3.7 Weekly metrics
- [ ] G3 passed

## Phase 4: bots and widget (gate G4: stable for two weeks)
- [ ] B4.1 Hello bots  - [ ] B4.2 OTP widget  - [ ] B4.3 Optional bot answer check  - [ ] B4.4 Email templates
- [ ] G4 passed

## Log
| Date | Task | What was done | Evidence | Next |
| --- | --- | --- | --- | --- |

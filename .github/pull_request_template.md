## What this adds
Test IDs:
Module / Feature:
Card(s):

## Checklist (reviewer: do not approve with a box unchecked)
- [ ] Title is `<ID>: <plain English>`; ID unique; tags and owner present
- [ ] Imports from `src/fixtures.mjs`; created items use `taggedName()` + `cleanup.add()`
- [ ] Messages only to `TEST_RECIPIENTS`; sends counted
- [ ] Asserts the REAL result (downstream proof where possible), not just "no error"
- [ ] Endpoints and fields taken from module.json or verified on dev
- [ ] Author showed the test PASSING, then FAILING on purpose, then restored (paste both outputs below)
- [ ] `mapping.json` updated in this PR (or a draft attached)
- [ ] `npm run check` green

## Evidence
```
(pass output)
(fail-on-purpose output)
```

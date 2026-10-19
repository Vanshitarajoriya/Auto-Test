// Turns Playwright's JSON report into a verdict. Pure code: the verdict can never come from a model.
// eslint-disable-next-line no-control-regex
const stripAnsi = (s) => String(s || '').replace(/\u001b\[[0-9;]*m/g, '');
export const idOf = (title) => (/^([A-Za-z]+-\d+):/.exec(title) || [])[1];

export function collectTests(report) {
  const out = [];
  const walk = (suite) => {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        const err = (t.results || []).map((r) => r.error?.message).filter(Boolean).pop();
        const lines = stripAnsi(err).split('\n').map((l) => l.trim()).filter(Boolean);
        const detail = lines.filter((l) => /^(Expected|Received)\b/.test(l)).slice(0, 2).join(' | ');
        out.push({ title: spec.title, id: idOf(spec.title), status: t.status, error: (detail || lines[0] || '').slice(0, 240) });
      }
    }
    for (const s of suite.suites || []) walk(s);
  };
  for (const s of report.suites || []) walk(s);
  return out;
}

/** expected -> passed, unexpected -> failed, flaky -> passed on retry (quarantined, flagged), skipped -> not run. */
export function judge(tests, expectedIds) {
  const relevant = tests.filter((t) => t.id && expectedIds.includes(t.id));
  const seen = new Set(relevant.map((t) => t.id));
  const missing = expectedIds.filter((id) => !seen.has(id));
  const failed = relevant.filter((t) => t.status === 'unexpected');
  const flaky = relevant.filter((t) => t.status === 'flaky');
  const skipped = relevant.filter((t) => t.status === 'skipped');
  const passed = relevant.filter((t) => t.status === 'expected' || t.status === 'flaky');

  let verdict = 'QA Passed';
  if (missing.length) verdict = 'Mapping error';
  else if (failed.length) verdict = 'QA Failed';
  else if (skipped.length) verdict = 'Blocked: environment';
  return { verdict, passed, failed, flaky, skipped, missing };
}

/** Canaries are written to FAIL. If any canary passes (or none ran), the suite itself is broken. */
export function canaryHealthy(tests) {
  const canaries = tests.filter((t) => t.id?.startsWith('CANARY'));
  return canaries.length >= 3 && canaries.every((t) => t.status === 'unexpected');
}

// Fixed templates for ClickUp comments and bug cards. Same input -> same text.
const clean = (title) => title.replace(/^[A-Za-z]+-\d+:\s*/, '').replace(/(\s+@[\w-]+)+\s*$/, '');
export function buildComment(r) {
  const lines = [
    `QA automation result: ${r.verdict}`,
    `Card: ${r.taskId || 'n/a'} | Module: ${r.module || 'n/a'} | Feature: ${(r.features || []).join(', ') || 'n/a'}`,
  ];
  if (r.testIds?.length && r.judged) {
    const j = r.judged;
    lines.push(`Tests: ${r.testIds.length} mapped, ${j.passed.length} passed, ${j.failed.length} failed, ${j.flaky.length} flaky`);
  } else if (r.testIds?.length) {
    lines.push(`Tests mapped: ${r.testIds.length} (none were run)`);
  }
  for (const f of r.judged?.failed || []) lines.push(`FAILED ${f.id}: ${clean(f.title)}${f.error ? ` -> ${f.error}` : ''}`);
  if (r.judged?.flaky?.length) lines.push(`Flaky (passed on retry, flagged for review): ${r.judged.flaky.map((t) => t.id).join(', ')}`);
  if (r.judged?.skipped?.length) lines.push(`Not run (skipped): ${r.judged.skipped.map((t) => t.id).join(', ')}`);
  if (r.judged?.missing?.length) lines.push(`Mapped but no such test exists: ${r.judged.missing.join(', ')}`);
  if (r.unmappedFeatures?.length) lines.push(`Manual testing still needed for: ${r.unmappedFeatures.join(', ')}`);
  if (r.reason) lines.push(`Reason: ${r.reason}`);
  for (const c of (r.preflight?.checks || []).filter((c) => !c.ok)) lines.push(`Pre-flight failed: ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
  if (r.runUrl) lines.push(`Run: ${r.runUrl} (report + traces in the artifacts)`);
  lines.push('AI calls in the verdict path: 0');
  return lines.join('\n');
}

export function buildBug(r, failure) {
  return {
    name: `[AUTO] ${failure.id} failed: ${clean(failure.title)}`,
    description: [
      `Test ID: ${failure.id}`,
      `Found on card: ${r.taskId || 'n/a'} (Module: ${r.module || 'n/a'}, Feature: ${(r.features || []).join(', ') || 'n/a'})`,
      `Failing check / actual: ${failure.error || 'see trace'}`,
      'Expected: see the assertion in the test file named by the ID above',
      `Evidence: ${r.runUrl || 'see playwright-report and trace in the run artifacts'}`,
    ].join('\n'),
  };
}

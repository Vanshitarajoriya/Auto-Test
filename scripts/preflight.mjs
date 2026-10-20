#!/usr/bin/env node
// Is the dev environment fit to test? Exit 0 = ready, 2 = not ready (report "Blocked: environment", never "Failed").
import '../src/config.mjs';
import { preflight } from '../src/preflight.mjs';

const r = await preflight({ skipNetwork: process.argv.includes('--skip-network-checks') });
for (const c of r.checks) console.log(`[${c.ok ? 'ok' : 'FAIL'}] ${c.name}${c.detail ? ` - ${c.detail}` : ''}`);
process.exit(r.ok ? 0 : 2);

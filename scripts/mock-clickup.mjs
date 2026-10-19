#!/usr/bin/env node
// Local fake ClickUp so you can test posting safely:
//   MOCK_MODULE=Platform MOCK_FEATURE=Safety node scripts/mock-clickup.mjs &
//   CLICKUP_API_BASE=http://localhost:4010/api/v2 CLICKUP_TOKEN=x node runner/run-card.mjs --task 123 --post-status --skip-network-checks
// Optional: MOCK_CARDS_FILE=<json> serves several cards by id (see demo/cards.json); MOCK_CALLS_FILE=<path> records calls.
// It mimics ClickUp's documented task shape, NOT its real behaviour.
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const port = Number(process.env.MOCK_PORT || 4010);
const moduleName = process.env.MOCK_MODULE || 'Platform';
const featureName = process.env.MOCK_FEATURE || 'Safety';
const callsFile = process.env.MOCK_CALLS_FILE || 'results/mock-calls.json';
const cards = process.env.MOCK_CARDS_FILE ? JSON.parse(readFileSync(process.env.MOCK_CARDS_FILE, 'utf8')) : null;
const calls = [];
mkdirSync(path.dirname(callsFile), { recursive: true });

function taskFor(id) {
  if (!cards) {
    return {
      id, name: 'Mock card', status: { status: 'ready for qa' }, list: { id: '1' },
      custom_fields: [
        { name: 'Module', type: 'drop_down', value: 0, type_config: { options: [{ id: 'm1', name: moduleName, orderindex: 0 }] } },
        { name: 'Feature', type: 'drop_down', value: 0, type_config: { options: [{ id: 'f1', name: featureName, orderindex: 0 }] } },
      ],
    };
  }
  const card = cards[id];
  if (!card) return null;
  const fields = [];
  const mods = card.allModules || [card.module];
  const feats = card.allFeatures || card.features || [];
  if (card.module || card.allModules) {
    fields.push({ name: 'Module', type: 'drop_down', value: card.module ? mods.indexOf(card.module) : null, type_config: { options: mods.map((m, i) => ({ id: `m${i}`, name: m, orderindex: i })) } });
  }
  if (card.features?.length || card.allFeatures) {
    fields.push({ name: 'Feature', type: 'labels', value: (card.features || []).map((f) => `f${feats.indexOf(f)}`), type_config: { options: feats.map((f, i) => ({ id: `f${i}`, label: f })) } });
  }
  return { id, name: card.name, status: { status: 'ready for qa' }, list: { id: '1' }, custom_fields: fields };
}

createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    calls.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : undefined, auth: !!req.headers.authorization });
    writeFileSync(callsFile, JSON.stringify(calls, null, 2));
    res.setHeader('content-type', 'application/json');
    if (req.method === 'GET' && req.url.startsWith('/api/v2/task/')) {
      const task = taskFor(decodeURIComponent(req.url.split('/').pop()));
      if (!task) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ err: 'Task not found' }));
      }
      return res.end(JSON.stringify(task));
    }
    if (req.method === 'GET' && req.url === '/api/v2/user') return res.end(JSON.stringify({ user: { id: 1, username: 'demo-user' } }));
    if (req.method === 'GET' && /^\/api\/v2\/list\/[^/]+$/.test(req.url)) {
      return res.end(JSON.stringify({ id: '1', name: 'Demo list', statuses: ['ready for qa', 'QA Passed', 'QA Failed', 'Blocked'].map((status) => ({ status })) }));
    }
    res.end(JSON.stringify({ ok: true, id: 'mock-id' }));
  });
}).listen(port, () => console.log(`mock ClickUp on http://localhost:${port}/api/v2`));

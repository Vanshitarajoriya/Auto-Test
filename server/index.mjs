#!/usr/bin/env node
// Hosted front door for the runner (Embarko or any Node host). No AI in this file: it only queues
// `runner/run-card.mjs` and `demo/run-demo.mjs`, one job at a time, and shows their results.
//   GET  /              status page (config check, recent runs, demo report)
//   GET  /health        JSON health
//   POST /run           {"task_id":"<clickup id>"}  header x-runner-secret   (viaSocket doorbell)
//   POST /demo          header x-runner-secret      (fake API + fake ClickUp; touches nothing real)
//   GET  /runs/<id>     one job: status, verdict, log
//   GET  /demo/report   last demo report (and its Playwright reports under /demo/output/)
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../src/config.mjs'; // loads .env when present

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // fileURLToPath: correct on Windows too
const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.RUNNER_SECRET || '';
const flag = (name) => process.env[name] === 'true';
const MAX_JOBS = 50;
const MAX_LOG = 200_000;

const jobs = []; // newest last
const queue = [];
let running = null;
let seq = 0;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function secretOk(req) {
  if (!SECRET) return false; // no secret configured = POST endpoints disabled
  const got = Buffer.from(String(req.headers['x-runner-secret'] || ''));
  const want = Buffer.from(SECRET);
  return got.length === want.length && timingSafeEqual(got, want);
}

// Week 1 is comment-only (decision D8). Status moves and bug cards need POST_STATUS / CREATE_BUGS = true.
function cardArgs(taskId) {
  const a = ['runner/run-card.mjs', '--task', taskId, '--post'];
  if (flag('POST_STATUS')) a.push('--post-status');
  if (flag('CREATE_BUGS')) a.push('--create-bug');
  return a;
}

function enqueue(kind, label, argv) {
  const job = { id: String(++seq), kind, label, argv, status: 'queued', queuedAt: new Date().toISOString(), log: '' };
  jobs.push(job);
  if (jobs.length > MAX_JOBS) jobs.splice(0, jobs.length - MAX_JOBS);
  queue.push(job);
  drain();
  return job;
}

function drain() {
  if (running || !queue.length) return;
  const job = (running = queue.shift());
  job.status = 'running';
  job.startedAt = new Date().toISOString();
  const child = spawn(process.execPath, job.argv, { cwd: ROOT, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } });
  const add = (d) => {
    job.log += d;
    if (job.log.length > MAX_LOG) job.log = job.log.slice(-MAX_LOG);
  };
  child.stdout.on('data', add);
  child.stderr.on('data', add);
  child.on('close', (code) => {
    job.exit = code;
    job.finishedAt = new Date().toISOString();
    const saved = /Result saved: (.+)/.exec(job.log)?.[1]?.trim();
    if (saved) {
      try {
        const r = JSON.parse(readFileSync(path.join(ROOT, saved), 'utf8'));
        job.verdict = r.verdict;
        job.reason = r.reason;
        job.cardName = r.cardName;
      } catch { /* result file unreadable: the log still has everything */ }
    }
    if (job.kind === 'demo') job.verdict = code === 0 ? 'Demo: everything behaved as designed' : 'Demo: something did not behave as designed';
    job.status = 'done';
    running = null;
    drain();
  });
}

function readBody(req, limit = 10_000) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (d) => {
      body += d;
      if (body.length > limit) reject(new Error('body too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body, null, 2) : body);
};
const publicJob = ({ argv, log, ...j }) => j;

function configChecks() {
  const has = (k) => !!process.env[k];
  return [
    { name: 'RUNNER_SECRET set (POST /run and /demo are off without it)', ok: has('RUNNER_SECRET') },
    { name: 'DEV_URL set (real card runs refuse to start without it)', ok: has('DEV_URL') },
    { name: 'ALLOWED_HOSTS set explicitly', ok: has('ALLOWED_HOSTS') },
    { name: 'MSG91_AUTHKEY set (automation account on dev)', ok: has('MSG91_AUTHKEY') },
    { name: 'TEST_RECIPIENTS set', ok: has('TEST_RECIPIENTS') },
    { name: 'CLICKUP_TOKEN set', ok: has('CLICKUP_TOKEN') },
  ];
}

function page() {
  const chip = (v) => {
    const cls = /Passed|as designed/.test(v || '') ? 'good' : /Failed|broken|not behave/.test(v || '') ? 'bad' : 'warn';
    return `<span class="chip ${cls}">${esc(v || '…')}</span>`;
  };
  const rows = [...jobs].reverse().map((j) => `<tr><td><a href="/runs/${j.id}">#${j.id}</a></td><td>${esc(j.label)}${j.cardName ? `<div class="muted">${esc(j.cardName)}</div>` : ''}</td><td>${j.status === 'done' ? chip(j.verdict || `exit ${j.exit}`) : esc(j.status)}</td><td class="muted">${esc((j.finishedAt || j.startedAt || j.queuedAt).replace('T', ' ').slice(0, 19))} UTC</td></tr>`).join('');
  const checks = configChecks().map((c) => `<li class="${c.ok ? 'good' : 'warn'}">${c.ok ? '✓' : '○'} ${esc(c.name)}</li>`).join('');
  const report = existsSync(path.join(ROOT, 'demo/output/demo-report.html')) ? '<a href="/demo/report">Open the last demo report</a>' : '<span class="muted">No demo run yet.</span>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>MSG91 QA Agent</title>
<style>
:root{--bg:#fff;--fg:#1a1a1a;--mut:#667;--line:#dcdce4;--card:#fafafc;--good:#117a3d;--bad:#c1272d;--warn:#9a6a00}
@media(prefers-color-scheme:dark){:root{--bg:#14151a;--fg:#ececf1;--mut:#9a9aaa;--line:#2c2e38;--card:#1b1c23;--good:#4cc27a;--bad:#ff6b70;--warn:#e0b34a}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}main{max-width:860px;margin:0 auto;padding:28px 16px 60px}
h1{font-size:24px;margin:0 0 4px}h2{margin:30px 0 10px;font-size:18px}.muted{color:var(--mut)}.good{color:var(--good)}.bad{color:var(--bad)}.warn{color:var(--warn)}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin:12px 0}ul{margin:0;padding-left:4px;list-style:none}
.chip{border:1px solid currentColor;border-radius:99px;padding:1px 10px;font-size:13px;white-space:nowrap}table{width:100%;border-collapse:collapse}td{border-top:1px solid var(--line);padding:8px 6px;vertical-align:top;font-size:14px}
a{color:inherit}input,button{font:inherit;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg)}button{cursor:pointer}form{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}input{flex:1;min-width:140px}
code{font-family:ui-monospace,monospace;font-size:13px}.wrap{overflow-x:auto}
</style></head><body><main>
<h1>MSG91 QA Agent</h1>
<p class="muted">Humans approve tests, Playwright runs them, plain code decides pass or fail. AI calls in the verdict path: 0.</p>
<section><b>Status</b> ${running ? `running #${esc(running.id)} (${esc(running.label)})` : 'idle'} · queued: ${queue.length}
<ul style="margin-top:8px">${checks}</ul></section>
<h2>Demo</h2>
<section><p class="muted">Six cards against a fake MSG91-style API and a fake ClickUp, plus the safety checks. Nothing real is touched. Takes about 2 minutes.</p>
<form id="demo"><input type="password" name="secret" placeholder="Runner secret" autocomplete="off" required><button>Run the demo</button></form>
<p>${report}</p></section>
<h2>Run a ClickUp card</h2>
<section><p class="muted">Same as the viaSocket doorbell. Needs the dev environment configured above; otherwise pre-flight returns "Blocked: environment".</p>
<form id="card"><input name="task_id" placeholder="ClickUp task id" required pattern="[A-Za-z0-9_-]+"><input type="password" name="secret" placeholder="Runner secret" autocomplete="off" required><button>Run card</button></form></section>
<p id="msg" class="muted"></p>
<h2>Recent runs</h2>
<div class="wrap"><table>${rows || '<tr><td class="muted">No runs yet.</td></tr>'}</table></div>
<h2>viaSocket doorbell</h2>
<section><code>POST /run</code> with header <code>x-runner-secret</code> and body <code>{"task_id":"&lt;id&gt;"}</code>. Answers 202 and queues the card; runs go one at a time.</section>
</main><script>
const msg=document.getElementById('msg');
async function go(url,secret,body){msg.textContent='Sending…';try{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-runner-secret':secret},body:JSON.stringify(body||{})});const j=await r.json();
if(r.ok){location.href='/runs/'+j.id}else{msg.textContent=j.error||('Error '+r.status)}}catch(e){msg.textContent=String(e)}}
document.getElementById('demo').onsubmit=e=>{e.preventDefault();go('/demo',e.target.secret.value)};
document.getElementById('card').onsubmit=e=>{e.preventDefault();go('/run',e.target.secret.value,{task_id:e.target.task_id.value.trim()})};
</script></body></html>`;
}

function jobPage(j) {
  const refresh = j.status === 'done' ? '' : '<meta http-equiv="refresh" content="3">';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${refresh}<title>Run #${esc(j.id)}</title>
<style>:root{--bg:#fff;--fg:#1a1a1a;--line:#dcdce4}@media(prefers-color-scheme:dark){:root{--bg:#14151a;--fg:#ececf1;--line:#2c2e38}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}main{max-width:960px;margin:0 auto;padding:24px 16px}a{color:inherit}
pre{white-space:pre-wrap;word-break:break-word;border:1px solid var(--line);border-radius:8px;padding:12px;font-size:13px}</style></head><body><main>
<p><a href="/">← back</a></p><h1>Run #${esc(j.id)}: ${esc(j.label)}</h1>
<p><b>${esc(j.status)}</b>${j.verdict ? ` · ${esc(j.verdict)}` : ''}${j.reason ? ` · ${esc(j.reason)}` : ''}${j.kind === 'demo' && j.status === 'done' ? ' · <a href="/demo/report">demo report</a>' : ''}</p>
<pre>${esc(j.log || '(no output yet)')}</pre></main></body></html>`;
}

// Static files from demo/output only, with path traversal refused.
function serveDemoFile(res, rel) {
  const base = path.join(ROOT, 'demo/output');
  const file = path.resolve(base, rel || 'demo-report.html');
  if (!file.startsWith(base + path.sep) || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, { error: 'not found' });
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.zip': 'application/zip', '.webm': 'video/webm' };
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');
    const p = url.pathname;
    if (req.method === 'GET' && p === '/') return send(res, 200, page(), 'text/html');
    if (req.method === 'GET' && p === '/health') return send(res, 200, { ok: true, running: running && running.id, queued: queue.length });
    if (req.method === 'GET' && p === '/runs') return send(res, 200, jobs.map(publicJob));
    const m = /^\/runs\/(\d+)(\.json)?$/.exec(p);
    if (req.method === 'GET' && m) {
      const j = jobs.find((x) => x.id === m[1]);
      if (!j) return send(res, 404, { error: 'no such run' });
      return m[2] ? send(res, 200, { ...publicJob(j), log: j.log }) : send(res, 200, jobPage(j), 'text/html');
    }
    if (req.method === 'GET' && p === '/demo/report') return serveDemoFile(res, 'demo-report.html');
    if (req.method === 'GET' && p.startsWith('/demo/output/')) return serveDemoFile(res, decodeURIComponent(p.slice('/demo/output/'.length)));

    if (req.method === 'POST' && (p === '/run' || p === '/demo')) {
      if (!secretOk(req)) return send(res, 401, { error: SECRET ? 'bad or missing x-runner-secret' : 'RUNNER_SECRET is not set on the server, so runs are disabled' });
      if (p === '/demo') {
        if ([running, ...queue].some((j) => j && j.kind === 'demo')) return send(res, 409, { error: 'a demo is already queued or running' });
        const job = enqueue('demo', 'Demo (fake API + fake ClickUp)', ['demo/run-demo.mjs']);
        return send(res, 202, { status: 'queued', id: job.id });
      }
      let body = {};
      try {
        body = JSON.parse((await readBody(req)) || '{}');
      } catch {
        return send(res, 400, { error: 'body must be JSON: {"task_id":"..."}' });
      }
      const taskId = String(body.task_id || '').trim();
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(taskId)) return send(res, 400, { error: 'task_id required (letters, digits, - and _ only)' });
      const dup = [running, ...queue].find((j) => j && j.kind === 'card' && j.label === `Card ${taskId}`);
      if (dup) return send(res, 200, { status: 'already queued', id: dup.id });
      const job = enqueue('card', `Card ${taskId}`, cardArgs(taskId));
      return send(res, 202, { status: 'queued', id: job.id, position: queue.length });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`MSG91 QA Agent on http://0.0.0.0:${PORT}  (POST /run {task_id}, POST /demo)`));

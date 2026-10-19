#!/usr/bin/env node
// FAKE "MSG91-style dev API" for the demo. It is NOT MSG91's real API: endpoints and responses are invented
// so the whole QA flow can run offline. Docs for the demo endpoints: demo/API.md
import { createServer } from 'node:http';
import { randomInt } from 'node:crypto';

const PORT = Number(process.env.DEMO_API_PORT || 4020);
const AUTHKEY = process.env.DEMO_AUTHKEY || 'demo-authkey';
const ADMIN = 'demo-admin';
const state = { requests: new Map(), inbox: new Map(), logs: [], templates: new Map(), bug: null, seq: 0 };

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};
const newOtp = (prev) => {
  let o;
  do o = String(randomInt(100000, 1000000));
  while (o === prev);
  return o;
};
const log = (request_id, mobile, event) => state.logs.push({ request_id, mobile, event, at: new Date().toISOString() });

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return json(res, 400, { type: 'error', code: 'bad_json' });
    }
    const p = url.pathname;
    const m = req.method;

    if (m === 'GET' && p === '/') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end('Demo MSG91-style dev API (fake)');
    }
    if (m === 'POST' && p === '/demo/admin/bug') {
      if (req.headers['x-demo-admin'] !== ADMIN) return json(res, 403, { type: 'error', code: 'forbidden' });
      state.bug = body.name || null;
      return json(res, 200, { type: 'success', bug: state.bug });
    }
    if (!p.startsWith('/demo/')) return json(res, 404, { type: 'error', code: 'not_found' });
    if (req.headers.authkey !== AUTHKEY) return json(res, 401, { type: 'error', code: 'auth_failure', message: 'Authentication failure' });

    if (m === 'POST' && p === '/demo/otp/send') {
      if (!body.mobile) return json(res, 400, { type: 'error', code: 'mobile_required' });
      const id = `req_${++state.seq}`;
      const otp = newOtp();
      state.requests.set(id, { mobile: String(body.mobile), otp, expiresAt: Date.now() + Number(body.expiry_ms || 300000), verified: false });
      state.inbox.set(String(body.mobile), { otp, request_id: id });
      log(id, body.mobile, 'sent');
      return json(res, 200, { type: 'success', request_id: id, message: 'OTP sent' });
    }
    if (m === 'POST' && p === '/demo/otp/verify') {
      const r = state.requests.get(body.request_id);
      if (!r) return json(res, 404, { type: 'error', code: 'unknown_request' });
      if (r.verified) return json(res, 400, { type: 'error', code: 'already_verified' });
      if (Date.now() > r.expiresAt) {
        log(body.request_id, r.mobile, 'expired');
        return json(res, 400, { type: 'error', code: 'otp_expired' });
      }
      const ok = String(body.otp) === r.otp || (state.bug === 'wrong-otp-accepted' && /^\d{6}$/.test(String(body.otp)));
      if (!ok) {
        log(body.request_id, r.mobile, 'failed');
        return json(res, 400, { type: 'error', code: 'invalid_otp' });
      }
      r.verified = true;
      log(body.request_id, r.mobile, 'verified');
      return json(res, 200, { type: 'success', message: 'OTP verified' });
    }
    if (m === 'POST' && p === '/demo/otp/resend') {
      const r = state.requests.get(body.request_id);
      if (!r) return json(res, 404, { type: 'error', code: 'unknown_request' });
      r.otp = newOtp(r.otp); // the previous OTP stops working
      r.expiresAt = Date.now() + 300000;
      r.verified = false;
      state.inbox.set(r.mobile, { otp: r.otp, request_id: body.request_id });
      log(body.request_id, r.mobile, 'resent');
      return json(res, 200, { type: 'success', message: 'OTP resent' });
    }
    if (m === 'GET' && p === '/demo/inbox') {
      const hit = state.inbox.get(url.searchParams.get('mobile'));
      return hit ? json(res, 200, hit) : json(res, 404, { type: 'error', code: 'nothing_received' });
    }
    if (m === 'GET' && p === '/demo/logs') {
      const id = url.searchParams.get('request_id');
      return json(res, 200, { logs: state.logs.filter((l) => !id || l.request_id === id) });
    }
    if (m === 'POST' && p === '/demo/templates') {
      if (!body.name) return json(res, 400, { type: 'error', code: 'name_required' });
      if (state.templates.has(body.name)) return json(res, 409, { type: 'error', code: 'exists' });
      state.templates.set(body.name, body.body || '');
      return json(res, 201, { type: 'success', name: body.name });
    }
    if (m === 'GET' && p === '/demo/templates') return json(res, 200, { templates: [...state.templates.keys()] });
    if (m === 'DELETE' && p.startsWith('/demo/templates/')) {
      const name = decodeURIComponent(p.slice('/demo/templates/'.length));
      return state.templates.delete(name) ? json(res, 200, { type: 'success' }) : json(res, 404, { type: 'error', code: 'not_found' });
    }
    return json(res, 404, { type: 'error', code: 'not_found' });
  });
});

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is already in use (set DEMO_API_PORT)` : e.message);
  process.exit(1);
});
server.listen(PORT, () => console.log(`fake MSG91-style API on http://localhost:${PORT}`));

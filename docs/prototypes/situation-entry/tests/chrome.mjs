// Headless Chrome over the DevTools protocol (Node's built-in WebSocket, no extra packages), plus a static server
// for the page. Used by situation-csp.test.mjs. A missing Chrome is an error, never a skip.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];
const CHROME_NAMES = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];

export function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const found = CHROME_PATHS.find((p) => existsSync(p))
    ?? CHROME_NAMES.map((n) => spawnSync('which', [n], { encoding: 'utf8' }).stdout.trim()).find(Boolean);
  if (!found) throw new Error(`Chrome not found: install Chrome or set CHROME_PATH (looked in ${[...CHROME_PATHS, ...CHROME_NAMES].join(', ')})`);
  return found;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

/** Serves `dir` on 127.0.0.1; `overrides` maps a path such as '/styles.css' to replacement text. */
export async function serve(dir, overrides = {}) {
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    const file = normalize(join(dir, path));
    let body = overrides[path];
    if (body === undefined && file.startsWith(dir) && existsSync(file) && extname(file)) body = readFileSync(file);
    if (body === undefined) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}

// Installed before any page script: every CSP violation the page sees.
const COLLECT = `window.__csp = [];
document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(
  { directive: e.effectiveDirective, blocked: e.blockedURI, sample: e.sample }));`;

export async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), 'situation-csp-'));
  const proc = spawn(findChrome(), ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let err = '';
    const timer = setTimeout(() => reject(new Error(`Chrome did not start within 15s:\n${err}`)), 15000);
    proc.on('error', (e) => { clearTimeout(timer); reject(e); });
    proc.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Chrome exited (${code}):\n${err}`)); });
    proc.stderr.on('data', (chunk) => {
      err += chunk;
      const m = err.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error(`cannot connect to ${wsUrl}`)); });
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id !== undefined) {
      const { resolve, reject, method } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${method}: ${msg.error.message}`)); else resolve(msg.result);
    } else listeners.forEach((fn) => fn(msg));
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject, method });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

  /** Opens `url` in a fresh tab; returns helpers to run script in it and the problems logged so far. */
  async function open(url) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const errors = [];
    const requests = [];
    let loaded;
    const load = new Promise((resolve) => { loaded = resolve; });
    listeners.add((msg) => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === 'Page.loadEventFired') loaded();
      if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
      if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(`${msg.params.entry.source}: ${msg.params.entry.text}`);
      if (msg.method === 'Network.requestWillBeSent') requests.push(msg.params.request.url);
    });
    for (const domain of ['Page', 'Runtime', 'Log', 'Network']) await send(`${domain}.enable`, {}, sessionId);
    await send('Page.addScriptToEvaluateOnNewDocument', { source: COLLECT }, sessionId);
    await send('Page.navigate', { url }, sessionId);
    await load;
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
      if (r.exceptionDetails) throw new Error(`page script failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    };
    return { evaluate, errors, requests, close: () => send('Target.closeTarget', { targetId }) };
  }

  async function close() {
    ws.close();
    proc.kill();
    await new Promise((r) => (proc.exitCode !== null ? r() : proc.once('exit', r)));
    rmSync(profile, { recursive: true, force: true });
  }
  return { open, close };
}

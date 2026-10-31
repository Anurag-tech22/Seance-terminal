import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { runSnippet, executeCompareEras } from '../server.js';

const freePort = () => new Promise(r => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
let fake, server, base, seenPrompts = [];

before(async () => {
  fake = http.createServer((req, res) => {
    let b = ''; req.on('data', c => (b += c));
    req.on('end', () => {
      if (req.url === '/api/tags') return res.end('{"models":[]}');
      if (req.url === '/api/embed') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ embeddings: [new Array(8).fill(0.1)] })); }
      if (req.url === '/api/chat') {
        const j = JSON.parse(b); seenPrompts.push(j.messages.map(m => m.content || '').join('\n'));
        if (j.tools && j.messages.some(m => m.content === 'reject-tools')) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'model does not support tools' }));
        }
        res.setHeader('Content-Type', 'application/x-ndjson');
        if (j.tools && !j.messages.some(m => m.role === 'tool')) {
          res.write(JSON.stringify({
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [{
                function: {
                  name: 'lookup_grimoire',
                  arguments: { query: 'cobol' }
                }
              }]
            },
            done: false
          }) + '\n');
          return res.end(JSON.stringify({ done: true }) + '\n');
        }
        ['Boo ', 'from ', 'the ', 'machine.'].forEach(w => res.write(JSON.stringify({ message: { role: 'assistant', content: w }, done: false }) + '\n'));
        return res.end(JSON.stringify({ done: true }) + '\n');
      }
      res.statusCode = 404; res.end();
    });
  });
  await new Promise(r => fake.listen(0, r));
  const port = await freePort();
  base = `http://localhost:${port}`;
  server = spawn('node', ['server.js'], { env: { ...process.env, PORT: String(port), OLLAMA_URL: `localhost:${fake.address().port}`, DATABASE_URL: '' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, bad) => { server.stdout.on('data', d => String(d).includes('listening') && ok()); setTimeout(() => bad(new Error('server did not start')), 8000); });
});
after(() => { server?.kill(); fake?.close(); });

const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const ndjson = async res => (await res.text()).trim().split('\n').filter(Boolean).map(l => JSON.parse(l));

test('health reports ollama online and security headers are set', async () => {
  const r = await fetch(base + '/api/health');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal((await r.json()).ollama, true);
});

test('chat validates input and streams tokens', async () => {
  assert.equal((await post('/api/seance', { spirit: 'nope', message: 'x' })).status, 400);
  assert.equal((await post('/api/seance', { spirit: 'cobol', message: '' })).status, 400);
  assert.equal((await post('/api/seance', { spirit: 'cobol', message: 'x'.repeat(4001) })).status, 400);
  const ev = await ndjson(await post('/api/seance', { spirit: 'cobol', message: 'hello' }));
  assert.equal(ev.filter(e => e.t).map(e => e.t).join(''), 'Boo from the machine.');
});

test('haunt mode wraps the shell command for the spirit', async () => {
  seenPrompts = [];
  const res = await post('/api/seance', { spirit: 'perl', mode: 'haunt', message: '$ ls\nexit code: 0', priv: true });
  assert.equal(res.status, 200); await res.text();
  assert.match(seenPrompts.at(-1), /shell command/);
});

test('images are rejected cleanly when oversized', async () => {
  assert.equal((await post('/api/seance', { spirit: 'ie6', message: 'hi', image: 'a'.repeat(3_000_001) })).status, 400);
});

test('ofrenda validates, streams and never calls the grimoire', async () => {
  assert.equal((await post('/api/ofrenda', { name: '', language: 'English', memory: 'x' })).status, 400);
  assert.equal((await post('/api/ofrenda', { name: 'Abuela', language: 'Klingon', memory: 'x' })).status, 400);
  assert.equal((await post('/api/ofrenda', { name: 'Abuela', language: 'English' })).status, 400);
  seenPrompts = [];
  const ev = await ndjson(await post('/api/ofrenda', { name: 'Abuela', language: 'Spanish', foods: 'tamales', verse: true }));
  assert.ok(ev.some(e => e.t));
  assert.match(seenPrompts.at(-1), /calaverita/);
  assert.doesNotMatch(seenPrompts.at(-1), /GRIMOIRE/);
});

test('council needs two to three distinct valid spirits', async () => {
  assert.equal((await post('/api/council', { spirits: ['cobol'], message: 'x' })).status, 400);
  assert.equal((await post('/api/council', { spirits: ['cobol', 'cobol'], message: 'x' })).status, 400);
  const ev = await ndjson(await post('/api/council', { spirits: ['cobol', 'perl'], message: 'typing?' }));
  assert.equal(ev.filter(e => e.speaker).length, 2);
});

test('chat invokes tool calling loop and streams tool and toolResult events', async () => {
  const ev = await ndjson(await post('/api/seance', { spirit: 'cobol', message: 'tell me about cobol' }, { 'x-eval': 'true' }));
  const toolEv = ev.find(e => e.tool);
  const resultEv = ev.find(e => e.toolResult);
  assert.ok(toolEv, 'expected tool event in NDJSON stream');
  assert.equal(toolEv.tool.name, 'lookup_grimoire');
  assert.deepEqual(toolEv.tool.args, { query: 'cobol' });
  assert.ok(resultEv, 'expected toolResult event in NDJSON stream');
  assert.equal(resultEv.toolResult.name, 'lookup_grimoire');
  assert.match(resultEv.toolResult.summary, /facts/i);
  assert.equal(ev.filter(e => e.t).map(e => e.t).join(''), 'Boo from the machine.');
});

test('run_snippet sandbox terminates while(true){} after 500 ms timeout', () => {
  const t0 = Date.now();
  const res = runSnippet('while(true){}');
  const elapsed = Date.now() - t0;
  assert.match(res.content, /timed out/i);
  assert.ok(elapsed >= 450, `Expected at least 500ms timeout, took ${elapsed}ms`);
});

test('run_snippet sandbox blocks require, process, fetch, and globalThis escape and caps at 2 KB', () => {
  assert.equal(runSnippet('typeof require').content, 'undefined');
  assert.equal(runSnippet('typeof process').content, 'undefined');
  assert.equal(runSnippet('typeof fetch').content, 'undefined');
  assert.equal(runSnippet('typeof globalThis.process').content, 'undefined');
  const capped = runSnippet('for (let i = 0; i < 300; i++) console.log("overflow output line " + i);');
  assert.ok(capped.content.length <= 2100);
  assert.match(capped.content, /capped at 2 KB/);
});

test('compare_eras returns one fact each from two different spirits', () => {
  const res = executeCompareEras('punch-card', 'cobol');
  assert.ok(res.content.includes(':'));
  assert.notEqual(res.s1, res.s2);
  assert.ok(res.summary.includes('contrasted'));
});

test('model rejecting tools retries without tools and sets toolsOff flag in health', async () => {
  const ev = await ndjson(await post('/api/seance', { spirit: 'cobol', message: 'reject-tools' }, { 'x-eval': 'true' }));
  assert.equal(ev.filter(e => e.t).map(e => e.t).join(''), 'Boo from the machine.');
  const h = await (await fetch(base + '/api/health')).json();
  assert.equal(h.toolsOff, true);
});

test('smoke script executes post-deploy checklist successfully', async () => {
  const p = spawn('node', ['scripts/smoke.mjs', base], { stdio: 'pipe' });
  let out = '';
  p.stdout.on('data', d => (out += d));
  p.stderr.on('data', d => (out += d));
  const code = await new Promise(r => p.on('close', r));
  assert.equal(code, 0, `smoke test failed with exit code ${code}:\n${out}`);
  assert.match(out, /All 5 post-deployment checks passed/);
});

test('rate limiter eventually answers 429', async () => {
  let last = 0;
  for (let i = 0; i < 25; i++) last = (await post('/api/seance', { spirit: 'nope' })).status;
  assert.equal(last, 429);
});



#!/usr/bin/env node
import assert from 'node:assert/strict';

const BASE = (process.argv[2] || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const HEAD = { 'Content-Type': 'application/json' };

console.log(`\n========================================`);
console.log(`🕯️  Séance Terminal Smoke Test Suite`);
console.log(`Target: ${BASE}`);
console.log(`========================================\n`);

async function readNdjson(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`HTTP ${res.status}: ${err.error || res.statusText}`);
  }
  const text = await res.text();
  const lines = text.trim().split('\n').filter(Boolean);
  return lines.map(l => JSON.parse(l));
}

let passed = 0;
let failed = 0;

async function runCheck(name, fn) {
  process.stdout.write(`[ ] ${name}... `);
  try {
    const detail = await fn();
    process.stdout.write(`\r[✔] ${name} ${detail ? `(${detail})` : ''}\n`);
    passed++;
  } catch (err) {
    process.stdout.write(`\r[✖] ${name}: FAILED\n    Error: ${err.message}\n`);
    failed++;
  }
}

// 1. Health check
await runCheck('1. Health check (/api/health)', async () => {
  const r = await fetch(`${BASE}/api/health`);
  assert.equal(r.status, 200, `Expected 200, got ${r.status}`);
  const h = await r.json();
  assert.equal(h.ok, true, 'Expected ok: true');
  assert.equal(typeof h.ollama, 'boolean', 'Expected boolean ollama field');
  return `model=${h.model}, ollama=${h.ollama ? 'online' : 'offline'}, db=${h.db?.ready ? 'connected' : 'memory off'}`;
});

// 2. A Chat
await runCheck('2. A Chat séance (/api/seance)', async () => {
  const r = await fetch(`${BASE}/api/seance`, {
    method: 'POST',
    headers: { ...HEAD, 'x-eval': 'true' },
    body: JSON.stringify({ spirit: 'cobol', message: 'Tell me of punch cards and batch processing.', mode: 'chat', priv: true })
  });
  const events = await readNdjson(r);
  const text = events.filter(e => e.t).map(e => e.t).join('').trim();
  assert.ok(text.length > 0, 'Expected streamed text tokens');
  return `preview: "${text.slice(0, 45).replace(/\n/g, ' ')}..."`;
});

// 3. A Council
await runCheck('3. A Council (/api/council)', async () => {
  const r = await fetch(`${BASE}/api/council`, {
    method: 'POST',
    headers: { ...HEAD, 'x-eval': 'true' },
    body: JSON.stringify({ spirits: ['cobol', 'perl'], message: 'What is the essence of legacy code?', priv: true })
  });
  const events = await readNdjson(r);
  const speakers = events.filter(e => e.speaker).map(e => e.speaker.name);
  const text = events.filter(e => e.t).map(e => e.t).join('').trim();
  assert.ok(speakers.length >= 2, 'Expected at least two speakers in council');
  assert.ok(text.length > 0, 'Expected streamed text from council');
  return `speakers: ${speakers.join(', ')}`;
});

// 4. An Ofrenda
await runCheck('4. An Ofrenda remembrance (/api/ofrenda)', async () => {
  const r = await fetch(`${BASE}/api/ofrenda`, {
    method: 'POST',
    headers: { ...HEAD, 'x-eval': 'true' },
    body: JSON.stringify({
      name: 'Ada Lovelace',
      relationship: 'Inspiration',
      memory: 'Visionary of the Analytical Engine',
      language: 'English',
      verse: true
    })
  });
  const events = await readNdjson(r);
  const text = events.filter(e => e.t).map(e => e.t).join('').trim();
  assert.ok(text.length > 0, 'Expected remembrance text in stream');
  return `preview: "${text.slice(0, 45).replace(/\n/g, ' ')}..."`;
});

// 5. The Graveyard chart
await runCheck('5. Graveyard telemetry (/api/stats)', async () => {
  const r = await fetch(`${BASE}/api/stats`);
  assert.equal(r.status, 200, `Expected 200, got ${r.status}`);
  const s = await r.json();
  if (s.offline) return 'TigerData offline (memory off mode)';
  return `${s.hourly?.length ?? 0} hourly buckets, ${s.memories ?? 0} memories`;
});

console.log(`\n========================================`);
if (failed > 0) {
  console.error(`💥 Smoke test suite failed: ${failed} check(s) failed, ${passed} passed.`);
  process.exitCode = 1;
} else {
  console.log(`🎉 All ${passed} post-deployment checks passed successfully!`);
  process.exitCode = 0;
}

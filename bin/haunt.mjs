#!/usr/bin/env node
// haunt <spirit> -- <command...>  : run a command, then let a spirit comment on it.
import { spawnSync } from 'node:child_process';

const [, , spirit, sep, ...cmd] = process.argv;
if (!spirit || sep !== '--' || !cmd.length) {
  console.error('Usage: haunt <spirit> -- <command...>\nSpirits: cobol perl flash vb6 ie6 python2 fortran\nExample: haunt perl -- ls -la\nSet SEANCE_URL to point at your server (default http://localhost:3000).');
  process.exit(2);
}
const base = (process.env.SEANCE_URL || 'http://localhost:3000').replace(/\/$/, '');
const r = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8', maxBuffer: 1 << 20, stdio: ['inherit', 'pipe', 'pipe'] });
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
const code = r.error ? 127 : (r.status ?? 1);
const out = ((r.stdout || '') + (r.stderr || '') + (r.error ? String(r.error.message) : '')).slice(0, 2500);
const message = `$ ${cmd.join(' ')}\nexit code: ${code}\n--- output ---\n${out}`.slice(0, 3800);

const AMBER = '\x1b[38;5;214m', RESET = '\x1b[0m';
try {
  // priv:true keeps your shell output out of the database and out of the echoes.
  const res = await fetch(`${base}/api/seance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spirit, mode: 'haunt', message, priv: true }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  process.stdout.write(`\n${AMBER}`);
  const dec = new TextDecoder(); let buf = '';
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!line) continue;
      const j = JSON.parse(line);
      if (j.t) process.stdout.write(j.t);
      if (j.err) throw new Error(j.err);
    }
  }
  process.stdout.write(`${RESET}\n`);
} catch (e) {
  process.stdout.write(`${RESET}\n(the spirit is silent: ${e.message})\n`);
}
process.exit(code);

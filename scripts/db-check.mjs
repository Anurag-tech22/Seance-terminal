#!/usr/bin/env node
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

// If DATABASE_URL is not set in environment, attempt to parse .env if present
let url = process.env.DATABASE_URL;
if (!url) {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const l of lines) {
      const match = l.match(/^\s*DATABASE_URL\s*=\s*(.*)$/);
      if (match) {
        url = match[1].trim().replace(/^['"]|['"]$/g, '');
        break;
      }
    }
  }
}

if (!url) {
  console.log('[db:check] DATABASE_URL is not set.');
  console.log('To check database capabilities on Tiger Cloud or local Postgres, provide DATABASE_URL:');
  console.log('  DATABASE_URL="postgres://user:pass@host:port/dbname" npm run db:check');
  process.exit(1);
}

try {
  const u = new URL(url);
  u.searchParams.delete('sslmode');
  const local = /(^|\.)(localhost|127\.0\.0\.1)$/.test(u.hostname);
  const pool = new pg.Pool({ connectionString: u.toString(), ssl: local ? false : { rejectUnauthorized: false }, max: 2 });

  console.log(`[db:check] Connecting to ${u.protocol}//${u.username ? '***' : ''}@${u.hostname}:${u.port || 5432}${u.pathname}...`);
  const vRes = await pool.query('SELECT version()');
  console.log(`[db:check] Connected: ${vRes.rows[0].version.split('\n')[0]}`);

  // 1. Extensions
  const extRes = await pool.query('SELECT extname, extversion FROM pg_extension WHERE extname IN ($1, $2)', ['vector', 'timescaledb']);
  const exts = Object.fromEntries(extRes.rows.map(r => [r.extname, r.extversion]));

  const hasVector = !!exts.vector;
  const hasTimescale = !!exts.timescaledb;

  console.log('\n--- Extensions ---');
  console.log(`  pgvector:    ${hasVector ? `active (v${exts.vector})` : 'inactive / missing'}`);
  console.log(`  timescaledb: ${hasTimescale ? `active (v${exts.timescaledb})` : 'inactive / missing'}`);

  // 2. Hypertables & Continuous Aggregates
  let isHypertable = false;
  let hasCagg = false;
  let hasCaggPolicy = false;
  let hasRetentionPolicy = false;

  if (hasTimescale) {
    try {
      const ht = await pool.query("SELECT hypertable_name FROM timescaledb_information.hypertables WHERE hypertable_name = 'seance_events'");
      isHypertable = ht.rows.length > 0;
    } catch {}

    try {
      const ca = await pool.query("SELECT view_name FROM timescaledb_information.continuous_aggregates WHERE view_name = 'hauntings_hourly'");
      hasCagg = ca.rows.length > 0;
    } catch {}

    try {
      const jobs = await pool.query("SELECT proc_name, schedule_interval FROM timescaledb_information.jobs WHERE hypertable_name = 'seance_events' OR proc_name LIKE '%cagg%' OR proc_name LIKE '%retention%'");
      hasCaggPolicy = jobs.rows.some(j => String(j.proc_name).includes('cagg') || String(j.proc_name).includes('continuous'));
      hasRetentionPolicy = jobs.rows.some(j => String(j.proc_name).includes('retention'));
    } catch {}
  }

  console.log('\n--- TimescaleDB Features ---');
  console.log(`  hypertable (seance_events):        ${isHypertable ? 'active' : 'not configured'}`);
  console.log(`  continuous aggregate (hauntings):  ${hasCagg ? 'active' : 'not configured'}`);
  console.log(`  continuous aggregate policy:       ${hasCaggPolicy ? 'active' : 'not configured'}`);
  console.log(`  retention policy:                  ${hasRetentionPolicy ? 'active' : 'not configured'}`);

  // 3. Row Counts
  console.log('\n--- Row Counts ---');
  const countTable = async (t) => {
    try {
      const res = await pool.query(`SELECT count(*)::int AS n FROM ${t}`);
      return res.rows[0].n;
    } catch {
      return null;
    }
  };

  const grimoireTotal = await countTable('grimoire');
  let grimoireEmbedded = null;
  if (grimoireTotal != null && hasVector) {
    try {
      const r = await pool.query('SELECT count(*)::int AS n FROM grimoire WHERE embedding IS NOT NULL');
      grimoireEmbedded = r.rows[0].n;
    } catch {}
  }

  const memoriesCount = await countTable('memories');
  const eventsCount = await countTable('seance_events');
  const caggCount = hasCagg ? await countTable('hauntings_hourly') : null;

  console.log(`  grimoire facts:      ${grimoireTotal != null ? `${grimoireTotal} rows` + (grimoireEmbedded != null ? ` (${grimoireEmbedded} embedded)` : '') : 'table missing'}`);
  console.log(`  memories (echoes):   ${memoriesCount != null ? `${memoriesCount} rows` : 'table missing'}`);
  console.log(`  seance_events:       ${eventsCount != null ? `${eventsCount} rows` : 'table missing'}`);
  if (hasCagg) {
    console.log(`  hauntings_hourly:    ${caggCount != null ? `${caggCount} buckets` : 'view empty'}`);
  }

  console.log('\n=============================================');
  console.log('[db:check] Database check complete.');
  await pool.end();
  process.exit(0);
} catch (e) {
  console.error('[db:check] Error connecting or querying database:', e.message);
  process.exit(1);
}

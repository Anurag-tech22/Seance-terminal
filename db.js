// TigerData (Tiger Cloud) layer: pgvector for the grimoire + echoes, TimescaleDB hypertable for séance telemetry.
import pg from 'pg';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const vec = v => '[' + v.join(',') + ']';

let pool = null;
export const caps = { ready: false, vector: false, timescale: false, cagg: false };

async function tryQuery(sql, params, label) {
  try {
    await pool.query(sql, params);
    if (label) console.log(`[db] ${label}: ready`);
    return true;
  } catch (e) {
    console.warn(`[db] ${label || sql.slice(0, 50)} skipped: ${e.message}`);
    return false;
  }
}

export async function init(embedFn, spirits) {
  const url = process.env.DATABASE_URL;
  if (!url) { console.log('[db] DATABASE_URL not set: memory features disabled'); return; }
  try {
    const u = new URL(url);
    u.searchParams.delete('sslmode');
    const local = /(^|\.)(localhost|127\.0\.0\.1)$/.test(u.hostname);
    pool = new pg.Pool({ connectionString: u.toString(), ssl: local ? false : { rejectUnauthorized: false }, max: 5 });
    await pool.query('SELECT 1');
    console.log('[db] connection: active');
  } catch (e) { console.error('[db] connection failed:', e.message); pool = null; return; }

  caps.vector = await tryQuery('CREATE EXTENSION IF NOT EXISTS vector', [], 'extension pgvector');
  caps.timescale = await tryQuery('CREATE EXTENSION IF NOT EXISTS timescaledb', [], 'extension timescaledb');

  const emb = caps.vector ? ', embedding vector(768)' : '';
  await pool.query(`CREATE TABLE IF NOT EXISTS grimoire (
      id SERIAL PRIMARY KEY, spirit TEXT NOT NULL, fact TEXT NOT NULL${emb},
      tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', fact)) STORED,
      UNIQUE (spirit, fact))`);
  await tryQuery('CREATE INDEX IF NOT EXISTS grimoire_tsv ON grimoire USING gin (tsv)', [], 'index grimoire_tsv');

  if (caps.vector) {
    await tryQuery('ALTER TABLE grimoire ADD COLUMN IF NOT EXISTS embedding vector(768)', [], 'grimoire embedding column');
    await pool.query(`CREATE TABLE IF NOT EXISTS memories (
      id BIGSERIAL PRIMARY KEY, spirit TEXT NOT NULL, content TEXT NOT NULL,
      embedding vector(768), created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await tryQuery('CREATE INDEX IF NOT EXISTS memories_emb ON memories USING hnsw (embedding vector_cosine_ops)', [], 'index memories_emb');
  }

  await pool.query(`CREATE TABLE IF NOT EXISTS seance_events (
      ts TIMESTAMPTZ NOT NULL DEFAULT now(), session_id TEXT, spirit TEXT NOT NULL,
      kind TEXT NOT NULL, latency_ms INT, model TEXT)`);

  if (caps.timescale) {
    caps.timescale = await tryQuery(`SELECT create_hypertable('seance_events','ts', if_not_exists => TRUE)`, [], 'hypertable seance_events');
  }
  if (caps.timescale) {
    caps.cagg = await tryQuery(`CREATE MATERIALIZED VIEW IF NOT EXISTS hauntings_hourly
      WITH (timescaledb.continuous) AS
      SELECT time_bucket('1 hour', ts) AS bucket, spirit, count(*)::int AS summons, avg(latency_ms)::int AS avg_ms
      FROM seance_events GROUP BY bucket, spirit WITH NO DATA`, [], 'continuous aggregate hauntings_hourly');
    if (!caps.cagg) {
      try {
        const { rows } = await pool.query(`SELECT 1 FROM timescaledb_information.continuous_aggregates WHERE view_name = 'hauntings_hourly'`);
        if (rows.length) caps.cagg = true;
      } catch {}
    }
    if (caps.cagg) {
      await tryQuery(`ALTER MATERIALIZED VIEW hauntings_hourly SET (timescaledb.materialized_only = false)`, [], 'real-time aggregate hauntings_hourly');
      await tryQuery(`SELECT add_continuous_aggregate_policy('hauntings_hourly', start_offset => INTERVAL '3 days', end_offset => INTERVAL '1 hour', schedule_interval => INTERVAL '5 minutes', if_not_exists => TRUE)`, [], 'continuous aggregate policy');
    }
    await tryQuery(`SELECT add_retention_policy('seance_events', INTERVAL '90 days', if_not_exists => TRUE)`, [], 'retention policy seance_events');
  }

  let seeded = 0;
  for (const s of Object.values(spirits)) {
    for (const f of s.facts) {
      const res = await pool.query('INSERT INTO grimoire (spirit, fact) VALUES ($1,$2) ON CONFLICT DO NOTHING', [s.id, f]);
      if (res.rowCount) seeded += res.rowCount;
    }
  }
  if (seeded > 0) console.log(`[db] seeded ${seeded} new facts into grimoire`);
  caps.ready = true;
  console.log('[db] ready', JSON.stringify(caps));
  embedPending(embedFn).catch(e => console.warn('[db] embedding loop stopped:', e.message));
}

// Ollama may still be pulling models on a cold start, so retry in the background.
async function embedPending(embedFn) {
  if (!caps.vector) return;
  for (let attempt = 0; attempt < 60; attempt++) {
    const { rows } = await pool.query('SELECT id, fact FROM grimoire WHERE embedding IS NULL');
    if (!rows.length) { console.log('[db] grimoire fully embedded'); return; }
    for (const r of rows) {
      const v = await embedFn(r.fact);
      if (v) await pool.query('UPDATE grimoire SET embedding = $1::vector WHERE id = $2', [vec(v), r.id]);
    }
    await sleep(15000);
  }
}

export async function searchGrimoire(spirit, query, v) {
  if (!caps.ready) return [];
  try {
    if (caps.vector && v) {
      const { rows } = await pool.query(`
        WITH vr AS (SELECT id, row_number() OVER (ORDER BY embedding <=> $2::vector) AS r
                    FROM grimoire WHERE spirit = $1 AND embedding IS NOT NULL
                    ORDER BY embedding <=> $2::vector LIMIT 20),
             tr AS (SELECT g.id, row_number() OVER (ORDER BY ts_rank_cd(g.tsv, q) DESC) AS r
                    FROM grimoire g, websearch_to_tsquery('english', $3) q
                    WHERE g.spirit = $1 AND g.tsv @@ q LIMIT 20)
        SELECT g.fact FROM grimoire g
        LEFT JOIN vr ON vr.id = g.id LEFT JOIN tr ON tr.id = g.id
        WHERE g.spirit = $1 AND (vr.id IS NOT NULL OR tr.id IS NOT NULL)
        ORDER BY COALESCE(1.0/(60+vr.r),0) + COALESCE(1.0/(60+tr.r),0) DESC LIMIT 4`,
        [spirit, vec(v), query.slice(0, 500)]);
      if (rows.length) return rows.map(r => r.fact);
    } else {
      const { rows } = await pool.query(`
        SELECT g.fact FROM grimoire g, websearch_to_tsquery('english', $2) q
        WHERE g.spirit = $1 AND g.tsv @@ q ORDER BY ts_rank_cd(g.tsv, q) DESC LIMIT 4`, [spirit, query.slice(0, 500)]);
      if (rows.length) return rows.map(r => r.fact);
    }
    const { rows } = await pool.query('SELECT fact FROM grimoire WHERE spirit = $1 ORDER BY id LIMIT 3', [spirit]);
    return rows.map(r => r.fact);
  } catch (e) { console.warn('[db] grimoire search failed:', e.message); return []; }
}

// "Echoes": similar questions earlier visitors asked this spirit (anonymous, no session id stored).
export async function searchEchoes(spirit, v) {
  if (!caps.ready || !caps.vector || !v) return [];
  try {
    const { rows } = await pool.query(
      `SELECT content FROM memories WHERE spirit = $1 AND embedding IS NOT NULL
       AND (embedding <=> $2::vector) < 0.45 ORDER BY embedding <=> $2::vector LIMIT 2`, [spirit, vec(v)]);
    return rows.map(r => r.content);
  } catch (e) { return []; }
}

export async function remember(spirit, content, v) {
  if (!caps.ready || !caps.vector || !v) return;
  await tryQuery('INSERT INTO memories (spirit, content, embedding) VALUES ($1,$2,$3::vector)', [spirit, content.slice(0, 300), vec(v)], 'remember');
}

export function logEvent(sessionId, spirit, kind, latency, model) {
  if (!caps.ready) return;
  tryQuery('INSERT INTO seance_events (session_id, spirit, kind, latency_ms, model) VALUES ($1,$2,$3,$4,$5)',
    [String(sessionId).slice(0, 64), spirit, kind, latency, model], 'log event');
}

export async function stats() {
  if (!caps.ready) return { offline: true };
  try {
    const bucket = caps.timescale ? "time_bucket('1 hour', ts)" : "date_trunc('hour', ts)";
    const hourly = await pool.query(`SELECT ${bucket} AS bucket, count(*)::int AS summons FROM seance_events
      WHERE ts > now() - interval '24 hours' GROUP BY 1 ORDER BY 1`);
    const src = caps.cagg
      ? `SELECT spirit, sum(summons)::int AS summons, avg(avg_ms)::int AS avg_ms FROM hauntings_hourly WHERE bucket > now() - interval '7 days' GROUP BY spirit`
      : `SELECT spirit, count(*)::int AS summons, avg(latency_ms)::int AS avg_ms FROM seance_events WHERE ts > now() - interval '7 days' GROUP BY spirit`;
    const bySpirit = await pool.query(`${src} ORDER BY summons DESC`);
    let memories = 0;
    if (caps.vector) memories = (await pool.query('SELECT count(*)::int AS n FROM memories')).rows[0].n;
    const kinds = await pool.query(`SELECT kind, count(*)::int AS n FROM seance_events WHERE ts > now() - interval '7 days' GROUP BY kind ORDER BY n DESC`);
    const lat = await pool.query(`SELECT (percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms))::int AS p95 FROM seance_events WHERE ts > now() - interval '24 hours'`);
    return { hourly: hourly.rows, bySpirit: bySpirit.rows, kinds: kinds.rows, p95: lat.rows[0]?.p95 ?? null, memories, caps };
  } catch (e) { return { offline: true, error: e.message }; }
}

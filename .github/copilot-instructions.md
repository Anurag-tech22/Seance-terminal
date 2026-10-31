# Copilot instructions for Séance Terminal

- Stack: Node 20 ES modules, Express, `pg`, plain HTML/CSS/JS frontend (no build step, no frameworks).
- LLM: Gemma via Ollama HTTP API only (`/api/chat`, `/api/embed`). Never add closed-model or cloud-LLM dependencies.
- Database: TigerData Postgres. Use pgvector for similarity, TimescaleDB hypertables for event data. All schema lives in `db.js` and must be idempotent (`IF NOT EXISTS`).
- Every DB feature must degrade gracefully: the app has to run with no `DATABASE_URL` and with Ollama offline (return a clear error, never crash).
- Spirits live in `spirits.js`. Facts must be verifiable; never invent dates or specs. Keep each spirit's reply under 130 words.
- Privacy: never store code submitted for review, never store session-identifying data in `memories`, honour the `priv` flag.
- Accessibility: keep focus styles, `prefers-reduced-motion` support and aria-live regions.
- Before committing run `npm run check`.
- Never store submitted code or screenshots. Only plain chat questions may become echoes, and only when `priv` is false.
- New spirits go in `spirits.js` with 6-8 verifiable facts each.

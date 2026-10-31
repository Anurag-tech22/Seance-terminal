# Antigravity upgrade prompt: Séance Terminal v3

Open this project folder in Antigravity and paste everything below the line.

---

You are upgrading an existing project called "Séance Terminal" (Node 20 ES modules, Express, pg, plain HTML/CSS/JS frontend in /public, no build step). Read .github/copilot-instructions.md, server.js, db.js, spirits.js and public/app.js FIRST and follow their conventions. Do not rewrite working code; extend it. Open-weight models only (Gemma via Ollama). No cloud LLM APIs, no API keys. Every feature must degrade gracefully when Ollama, the database or the browser API is missing. Run `npm run check` and the new tests after each phase and fix failures before moving on.

PHASE 1: Agentic spirits (function calling)
- In server.js add a tool-calling loop for mode "chat" using Ollama's /api/chat "tools" parameter. Tools:
  1. lookup_grimoire({query}) -> top facts from db.searchGrimoire
  2. run_snippet({language: "javascript", code}) -> runs in node:vm with a 500 ms timeout, no require/process/fetch, output capped at 2 KB
  3. compare_eras({topic}) -> returns two grimoire facts from two different spirits for contrast
- Max 3 tool rounds per turn. Stream tool activity to the client as NDJSON events {tool:{name,args}} and {toolResult:{name,summary}}. Render them as small "the spirit consults..." lines in the log.
- If the model does not support tools, fall back to the current non-tool flow automatically and show a "tools off" badge.

PHASE 2: Ofrenda mode
- New route /ofrenda.html plus /api/ofrenda (streaming NDJSON).
- UI: form for name, relationship, favorite foods, songs, stories, and a free-text memory. A warm marigold/papel-picado theme distinct from the spooky UI but sharing style.css tokens.
- Gemma writes a short, respectful remembrance (calaverita-style verse optional toggle) in the language chosen (English/Spanish/Hindi/Marathi).
- Output renders as an ofrenda: candle, marigold border, photo upload (stays in the browser, never sent to the server), downloadable as a single self-contained HTML file.
- PRIVACY: nothing from this mode is logged, embedded, or stored. No db.logEvent, no remember(). Show a visible "stays on this machine" note.

PHASE 3: Voice
- Add push-to-talk: use the browser MediaRecorder, send audio to a new /api/transcribe that proxies to a local whisper.cpp server (WHISPER_URL env, default http://localhost:8080/inference). If unreachable, hide the mic button and show a hint. Optional env, never required.
- Keep the existing "Speak aloud" toggle for replies.

PHASE 4: Haunted shell (bin/haunt.mjs)
- A Node CLI: `haunt <spirit> -- <command...>` runs the command, captures stdout/stderr/exit code (cap 4 KB), POSTs to /api/seance with a new mode "haunt", and prints the spirit's commentary in amber ANSI color. Add an npm "bin" entry and README usage. The spirit comments on the command with one short eerie line plus one genuinely correct tip.

PHASE 5: Eval harness (npm run eval)
- test/eval.mjs: for each spirit, run 5 fixed prompts against the running server and assert: reply under 150 words, no emojis, mentions at least one grimoire-consistent fact when asked a domain question, and never states a year not present in that spirit's facts. Print a pass-rate table and exit non-zero below 80%.
- test/unit.mjs using node:test: validation errors, rate limiter, sandbox timeout, NDJSON parsing. Add both to CI (.github/workflows/ci.yml; the eval step only runs when OLLAMA_URL is set).

PHASE 6: Hardening and polish
- Add security headers (CSP default-src 'self', X-Content-Type-Options, Referrer-Policy) via middleware, no new dependencies.
- Retry Ollama /api/chat once on connection reset. Add request IDs to logs.
- Accessibility pass: labels, focus order, contrast, keyboard operation of council pick, reduced-motion for every animation.
- Update README (features table, architecture diagram in Mermaid, env vars, "why open models" section with a "where open beat closed" paragraph) and .github/copilot-instructions.md with the new rules.

ACCEPTANCE
- `npm run check`, `node --test`, and `npm run eval` pass with a local gemma3:4b.
- App still runs with no DATABASE_URL and with Ollama offline (clear error).
- Submitted code, screenshots, audio and ofrenda content are never stored.
- Final answer: list changed files and any assumption you made.

NOTE: gemma3 may not accept tools through Ollama. If Phase 1 fails for that reason, set GEN_MODEL to a tool-capable open model (for example qwen3 or llama3.1); the fallback keeps the app working either way.

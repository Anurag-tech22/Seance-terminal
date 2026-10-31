# Deployment Guide: Séance Terminal

This guide outlines the production deployment of **Séance Terminal** on **Render** with **Tiger Cloud (TimescaleDB + pgvector)** and a custom **.tech** domain.

---

## Architecture Overview

Séance Terminal runs entirely on open-weight models with zero cloud AI API dependencies:

```
                      ┌──────────────────────────────────────────────┐
                      │                 Render Mesh                  │
                      │                                              │
    Internet          │   ┌────────────────┐   Private Network       │
 (Custom .tech) ────► │   │seance-terminal │ ────────────────────┐   │
                      │   │  (Web Service) │   (OLLAMA_URL       │   │
                      │   └───────┬────────┘    hostport)        │   │
                      │           │                              ▼   │
                      └───────────┼─────────────── ┌─────────────────┤
                                  │                │  seance-ollama  │
                                  │                │(Private Service)│
                                  │                │  (Ollama Docker)│
                                  ▼                └────────┬────────┘
                         ┌──────────────────┐               │
                         │   Tiger Cloud    │               ▼
                         │  (TimescaleDB +  │      ┌─────────────────┐
                         │    pgvector)     │      │ 10 GB Persistent│
                         └──────────────────┘      │   Models Disk   │
                                                   └─────────────────┘
```

1. **`seance-terminal` (Web Service)**: Node.js 20 Express server hosting the static UI and streaming NDJSON API endpoints (`/api/seance`, `/api/council`, `/api/ofrenda`, `/api/health`, `/api/stats`).
2. **`seance-ollama` (Private Service)**: Dockerized Ollama serving open models locally over Render's private network mesh (listening on port 11434). Backed by a 10 GB persistent disk mounted at `/root/.ollama` so downloaded model weights persist across restarts and deploys.
3. **Tiger Cloud (PostgreSQL)**: External managed Postgres instance providing `pgvector` for semantic search over verified grimoire facts and visitor echoes, and TimescaleDB for time-series hauntings telemetry and the live graveyard chart.

---

## Step 1: Tiger Cloud Service Creation

1. Navigate to the **[Tiger Cloud Console](https://cloud.tigerdata.com)** (or Timescale Cloud console) and create a free or standard account.
2. Click **Create Service**:
   - **Service Name**: `seance-db` (or your choice).
   - **Region**: Choose the region closest to your Render services (e.g. `US-West / Oregon`).
3. Once the database instance is provisioned, copy the connection string displayed on the credentials screen:
   ```text
   postgres://tsdbadmin:<PASSWORD>@<HOST>:<PORT>/tsdb?sslmode=require
   ```
4. **Automatic Migration & Seeding**: You do not need to run manual SQL setup scripts. When Séance Terminal connects to `DATABASE_URL` upon first boot, `db.js` automatically:
   - Activates `pgvector` and `timescaledb` extensions.
   - Creates the `grimoire`, `memories`, and `seance_events` tables.
   - Sets up the `seance_events` hypertable and `hauntings_hourly` continuous aggregate view.
   - Configures the 90-day event retention policy.
   - Seeds all historical grimoire facts for each of the seven spirits and generates vector embeddings in the background.

---

## Step 2: Render Blueprint Deployment

Séance Terminal uses a declarative `render.yaml` Blueprint to coordinate the web service, private Ollama container, persistent disk, and private networking hostport injection.

1. Fork or push the Séance Terminal repository to your GitHub account.
2. Open the **[Render Dashboard](https://dashboard.render.com)**.
3. Click **New +** and select **Blueprint**.
4. Connect your GitHub repository. Render will automatically parse `render.yaml`.
5. You will be prompted to enter service parameters:
   - **`DATABASE_URL`**: Paste your Tiger Cloud connection string obtained in Step 1.
   - **`GEN_MODEL`** (defaults to `gemma3:1b` for lightweight memory, or `gemma3:4b` if your private service is configured with a larger plan for vision support).
   - **`EMBED_MODEL`** (defaults to `embeddinggemma`).
6. Click **Apply Blueprint**.

### Understanding Cold-Start Initialization
On the very first deployment, `seance-ollama` pulls the model weights into the `/root/.ollama` persistent disk:
- `ollama serve` starts immediately and accepts requests on private port 11434.
- During the first 2–5 minutes, `start.sh` downloads the model weights.
- The web service (`seance-terminal`) remains completely healthy and passes Render's HTTP health checks (`/api/health` returns HTTP 200).
- The web UI will show a friendly status badge: `Gemma: gemma3:1b (the spirits are still waking (model downloading))`.
- Once downloaded, the model is cached on the 10 GB persistent disk and subsequent container reboots start in seconds without re-downloading.

---

## Step 3: Setting & Verifying DATABASE_URL

If you did not provide `DATABASE_URL` during initial Blueprint creation, or need to rotate credentials:

1. In the Render Dashboard, navigate to **`seance-terminal`** > **Environment**.
2. Add or update the variable:
   - **Key**: `DATABASE_URL`
   - **Value**: `postgres://tsdbadmin:<PASSWORD>@<HOST>:<PORT>/tsdb?sslmode=require`
3. Click **Save Changes** (Render will trigger a zero-downtime redeploy).
4. Run the database verification script locally or in the Render Shell:
   ```bash
   DATABASE_URL="postgres://tsdbadmin:<PASSWORD>@<HOST>:<PORT>/tsdb?sslmode=require" npm run db:check
   ```
   The script verifies connection, `pgvector`, `timescaledb`, hypertables, continuous aggregates, and row counts.

---

## Step 4: Attaching a Custom .tech Domain

1. **Obtain your domain**:
   - Eligible students can claim a free 1-year `.tech` domain via the [GitHub Student Developer Pack](https://education.github.com/pack).
   - Alternatively, register a domain at [get.tech](https://get.tech).
2. **Add domain in Render**:
   - In the Render Dashboard, open **`seance-terminal`** > **Settings** > **Custom Domains**.
   - Click **Add Custom Domain**.
   - Enter your domain (e.g. `seance.tech` and/or `www.seance.tech`).
3. **Configure DNS Records** in your domain registrar's DNS management console:
   - **Subdomain (`www` or `app`)**:
     - **Type**: `CNAME`
     - **Name**: `www` (or `app`)
     - **Value / Target**: `seance-terminal.onrender.com`
   - **Apex / Root domain (`seance.tech`)**:
     - **Type**: `ANAME` or `ALIAS` (or `A` records pointing to Render's IP addresses shown in the dashboard).
4. **TLS Certificate Issuance**:
   - Render automatically provisions and renews a free Let's Encrypt TLS certificate.
   - Wait 5–15 minutes for DNS propagation and certificate verification. Once completed, your custom `.tech` domain will serve over HTTPS.

---

## Step 5: Post-Deployment Verification Checklist

Once deployed, verify all capabilities using either the manual checklist or the automated smoke test script.

### Automated Smoke Verification

Run the included smoke test script against your production deployment URL:

```bash
npm run smoke https://your-domain.tech
# or:
node scripts/smoke.mjs https://seance-terminal.onrender.com
```

### Manual Checklist

| Step | Target Endpoint / Action | What to verify |
|---|---|---|
| **1. Health Check** | `GET /api/health` | HTTP 200. JSON response shows `ok: true`, `ollama: true`, `db.ready: true`, and `modelReady: true`. |
| **2. Chat Séance** | Select **COBOL** and send a question | Reply streams live tokens (`{t: ...}`) with verified grimoire citations. If using a tool-capable model, spirit tool activity lines appear in the transcript. |
| **3. The Council** | Click **Convene a council**, pick 2-3 spirits (e.g. Perl & Flash), pose a question | Spirits answer sequentially in turn, referencing earlier speakers by name. |
| **4. Ofrenda** | Open `/ofrenda.html` | Fill in a remembrance, select a language and calaverita verse. Stream completes with zero storage or server persistence, and the remembrance card can be downloaded as a standalone HTML file. |
| **5. Graveyard Chart** | Inspect bottom section of `/` | Live hourly hauntings bar chart and p95 latency populated from the TimescaleDB hypertable continuous aggregate. |

---

## Troubleshooting & Maintenance

- **Checking Ollama model status**:
  ```bash
  curl https://your-domain.tech/api/health
  ```
  If `modelReady: false`, Ollama is still pulling weights to disk. Check the private service logs in the Render dashboard for download progress.
- **Switching Models**:
  To switch to a tool-capable model (like `llama3.1:8b` or `qwen2.5:7b`), upgrade the `seance-ollama` instance plan to provide sufficient RAM, and update `GEN_MODEL` in Render's environment settings.
- **Database Inspection**:
  Run `npm run db:check` anytime to inspect TimescaleDB continuous aggregate policies, hypertable status, and vector row counts.

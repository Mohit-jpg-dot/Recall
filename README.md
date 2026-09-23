# Recall

### Your browser remembers everything. You don't.

**Recall is a privacy-first personal memory layer for the web.**

It lets you search your browsing history using the way you actually remember things — **not exact URLs, not perfect keywords, not browser-history archaeology.**

> *“What was that GitHub repo about CUDA memory I saw last week?”*

> *“There was a psychological thriller someone recommended on Reddit…”*

> *“Find that React animation tutorial I watched yesterday.”*

**Recall finds the memory.**

---

<p align="center">

**🧠 Remember the idea. Recall the source.**

</p>

---

## Why Recall?

The internet is full of things we discover and immediately forget.

An article.

A GitHub repository.

A YouTube video.

A Stack Overflow answer.

A research paper.

A product.

A Reddit thread.

You remember **what it was about**.

You might remember **roughly when you saw it**.

You might remember **where you saw it**.

But you probably don't remember the URL.

Traditional browser history expects you to search like a machine.

Recall lets you search like a human.

### Instead of:

```text
github.com/...
```

or

```text
cuda memory
```

### You can ask:

```text
that github repo about cuda memory from last week
```

Recall combines **semantic meaning + keywords + time + domain + browsing context** to reconstruct what you were looking for.

---

# ✨ What Recall Does

### 🔎 Search by memory

Search your browsing history using natural language.

```text
"that Spring Boot article I read a few days ago"
```

```text
"React animation tutorial from yesterday morning"
```

```text
"the Reddit discussion about psychological thrillers"
```

Recall understands the intent behind the query instead of requiring an exact match.

---

### 🧠 AI Memory Chat

Don't just search.

**Ask Recall.**

```text
What was the GitHub repository I looked at
when I was researching CUDA memory?
```

Recall retrieves relevant memories and generates a grounded answer with clickable sources.

Every answer is tied back to the memories it used.

No evidence → no invented answer.

---

### 🕒 Timeline

See what you explored over time.

Your browsing history becomes a chronological memory stream instead of an endless list of URLs.

---

### 🧭 Research Journeys

Recall can group related browsing activity into research sessions.

For example:

```text
Google
   ↓
NVIDIA CUDA Documentation
   ↓
Stack Overflow
   ↓
GitHub Repository
   ↓
YouTube Tutorial
```

Instead of remembering five disconnected pages, you can remember the **journey**.

---

### 🏷️ Memory Topics

Your browsing activity can be organized into meaningful topics.

```text
AI / ML
Backend
Java
CUDA
Research
Projects
Entertainment
```

So your history becomes something you can actually navigate.

---

### 🔐 Privacy Controls

Your browsing history is extremely personal.

Recall is designed around that reality.

You control what gets remembered.

* Explicit collection control
* Master pause/resume
* Excluded domains
* Individual memory deletion
* Delete memories by date
* Delete memories by domain
* Full JSON export
* Account/memory wipe
* User-isolated data access

The browser extension is intentionally lightweight and does **not** use AI on the client.

---

# 🛡️ What Recall Records

Recall currently focuses on browsing metadata required for memory retrieval:

```text
✓ Page URL
✓ Page title
✓ Visit timestamp
✓ Domain
✓ Browser source
✓ Research session
✓ Topic information
```

### Recall does NOT intentionally collect:

```text
✗ Passwords
✗ Form values
✗ Credit card information
✗ Cookies
✗ Authentication/session tokens
✗ Incognito/private browsing activity
```

You can also configure domains that Recall should never remember.

> **Your browser history belongs to you.**
>
> Recall should make it more useful — not less private.

---

# ⚡ Built to Stay Out of Your Way

Recall isn't supposed to become another application constantly consuming your resources.

The Chrome extension is deliberately lightweight.

### Extension

* Manifest V3
* Event-based observation
* No DOM scraping
* No client-side AI
* Local resilient queue
* Event deduplication
* Batched synchronization
* Exponential retry
* Bounded local storage
* Pause/resume control

The extension primarily observes navigation metadata, filters it, queues it locally, and synchronizes batches with the Recall API.

### Current queue design

```text
Browser Event
      ↓
Privacy Filter
      ↓
Local Queue
      ↓
Batch Manager
      ↓
Recall API
```

If the network disappears, the queue can retain events and retry later.

---

# 🚀 Hybrid Retrieval

Recall doesn't depend on a single search technique.

It combines multiple signals to find the memory you're actually looking for.

```text
                User Query
                    │
                    ▼
             Intent Parsing
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
     Keywords      Time       Domain
        │           │           │
        └───────────┼───────────┘
                    ▼
             Semantic Search
                    │
                    ▼
             Candidate Pool
                    │
                    ▼
        Ranking / Relevance Fusion
                    │
                    ▼
             Best Memories
```

| Signal              | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| Semantic similarity | Understand conceptual meaning                            |
| Keyword relevance   | Match explicit terms                                     |
| Temporal proximity  | Understand phrases like “last week”                      |
| Recency             | Prefer relevant recent discoveries                       |
| Session cohesion    | Connect pages from the same research journey             |
| Domain metadata     | Understand sources such as GitHub, Reddit, YouTube, etc. |

This allows queries such as:

```text
"that github repo about cuda memory from last week"
```

to be decomposed into useful retrieval signals rather than treated as one giant keyword string.

---

# 🤖 Grounded AI

Recall's conversational layer uses retrieved browsing memories as its evidence.

```text
User Question
      ↓
Query Understanding
      ↓
Hybrid Retrieval
      ↓
Relevant Memories
      ↓
Context Builder
      ↓
LLM
      ↓
Answer + Sources
```

The goal is simple:

> **The AI should remember what you actually visited, not make up what you might have visited.**

Responses include source information such as:

* Page title
* Domain
* Visit date
* URL

If there isn't enough evidence, Recall should say so.

---

# 🏗️ Architecture

```mermaid
graph TB

    B["Chrome Browser"]
    E["Manifest V3 Extension"]

    W["Recall Web App"]
    A["FastAPI API"]

    P[("PostgreSQL 16")]
    V[("pgvector")]
    R[("Redis")]

    BG["Background Workers"]

    HS["Hybrid Search"]
    RAG["Grounded RAG"]

    B --> E
    E -->|"Batched Events"| A

    W -->|"Search / Chat"| A

    A --> P
    A --> V
    A --> R

    R --> BG
    BG --> V

    A --> HS
    HS --> P
    HS --> V

    HS --> RAG
```

### Core stack

**Frontend**

* React
* TypeScript
* Vite
* Custom responsive UI

**Backend**

* Python
* FastAPI
* Async SQLAlchemy
* JWT authentication

**Data**

* PostgreSQL 16
* pgvector
* Redis

**Browser**

* Chrome Manifest V3
* Lightweight service worker
* Local persistent queue

**AI**

* Embeddings
* Vector retrieval
* Grounded conversational RAG

---

# 📦 Repository Structure

```text
Recall/
│
├── apps/
│   ├── api/
│   ├── web/
│   └── extension-chrome/
│
├── packages/
│   └── shared-types/
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

# 🔬 Performance

Recall is designed around asynchronous processing and bounded workloads.

### Browser extension

```text
Zero-AI client
      ↓
Event observation
      ↓
Deduplication
      ↓
Local queue
      ↓
Batch upload
```

### Backend

* Async FastAPI handlers
* PostgreSQL connection pooling
* Redis-backed background processing
* Indexed retrieval
* Batch event ingestion
* Asynchronous embeddings
* Paginated memory queries

### Current search benchmark

On the development dataset, the hybrid search path has been measured at approximately:

> **~11 ms**

for a tested CUDA-memory query.

This is a development measurement, not a universal production latency guarantee.

---

# 🧪 Verification

The current implementation has been tested across the primary Recall flow.

### API

* Search endpoint verified
* Conversational RAG verified
* Grounded citations verified

### Frontend

* Production TypeScript build
* Browser interaction testing
* Landing page
* Demo login
* Natural-language memory search
* AI memory chat

### Extension

* Manifest V3 build
* Local queue
* Synchronization
* Privacy filtering
* Pairing flow
* Pause control

---

# 🛠️ Getting Started & Local Development

## Prerequisites

* **Node.js**: v18+ (v20+ recommended)
* **Python**: v3.11+
* **PostgreSQL**: v16+ with `pgvector` extension
* **Redis**: v7+

---

## 1. Local Database Setup

Start PostgreSQL and Redis:

```bash
brew services start postgresql@16
brew services start redis
```

Create database and enable pgvector:

```bash
createdb recall
psql -d recall -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

---

## 2. API Server

```bash
cd apps/api

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start API (tables and indexes auto-initialize on startup)
uvicorn app.main:app --port 8000 --host 0.0.0.0 --reload
```

* **API**: `http://127.0.0.1:8000`
* **Swagger Docs**: `http://127.0.0.1:8000/docs`
* **Health Check**: `http://127.0.0.1:8000/api/health`

---

## 3. Web Dashboard

```bash
cd apps/web
npm install
npm run dev -- --port 5173
```

Visit `http://localhost:5173` to register a new account or sign in.

---

# 🌐 Browser Extension Setup (Chrome, Firefox & Safari)

Recall features a unified, cross-browser Manifest V3 extension with native builds for all three major browser engines.

### Build All Extensions

```bash
cd apps/extension-chrome
npm install
npm run build
```

This compiles dedicated builds into:
* `dist/chrome/`
* `dist/firefox/`
* `dist/safari/`

---

### Installing in Google Chrome / Brave / Edge

1. Open `chrome://extensions` in your browser.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the directory:
   ```text
   Recall/apps/extension-chrome/dist/chrome
   ```

---

### Installing in Mozilla Firefox

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on…**.
3. Select the `manifest.json` file inside:
   ```text
   Recall/apps/extension-chrome/dist/firefox/manifest.json
   ```

---

### Installing in Apple Safari (macOS)

Safari requires a native macOS App Extension wrapper around the WebExtension bundle:

1. Ensure Xcode is installed:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
2. Run the automated Safari packager:
   ```bash
   cd apps/extension-chrome
   npm run package:safari
   ```
3. Open the generated Xcode project in `safari-app/Recall/Recall.xcodeproj`.
4. Select your developer signing team and click **Run** (`Cmd + R`).
5. Open Safari -> **Settings** -> **Extensions**, and check **Recall**.

---

## 🔗 Pairing Your Browser with Recall

Recall uses cryptographically secure single-use pairing tokens for zero-credential extension pairing:

1. Log into your Recall web dashboard (`http://localhost:5173` or your production domain).
2. Navigate to the **Browsers** tab in the sidebar.
3. Click **Generate Pairing Token** to receive your 15-minute pairing code (`recall_<id>_<secret>`).
4. Click the **Recall icon** in your browser's extension toolbar.
5. In the **Pairing Token** tab, paste the code and click **Pair Extension**.
6. The extension is now securely paired! You can connect multiple browsers (Chrome, Firefox, Safari) to the same Recall account.

---

# 🚀 Production Multi-User Deployment

### Production Docker Architecture

Recall provides a turnkey production stack via `docker-compose.prod.yml`:

```
Internet ──> Nginx (apps/web) [Port 80]
               │
               ├── /api/* ──> Uvicorn (apps/api) [Port 8000]
               │                │
               │                ├──> PostgreSQL 16 + pgvector (Persistent Volume)
               │                └──> Redis 7 (Rate limiting & queues)
```

### 1. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Generate secure production secrets:

```bash
# Generate JWT Secret
openssl rand -hex 32

# Generate Database Password
openssl rand -hex 24
```

Set these in your `.env` along with your production domains:

```env
ENVIRONMENT=production
CORS_ORIGINS=https://recall.yourdomain.com
DATABASE_URL=postgresql+asyncpg://recall:YOUR_DB_PASSWORD@postgres:5432/recall
JWT_SECRET=YOUR_JWT_SECRET
```

### 2. Launch Production Stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Verify services:

```bash
docker compose -f docker-compose.prod.yml ps
curl http://localhost:8000/api/health
```

---

# 🔒 Security & Multi-Tenant Isolation

| Layer | Implementation |
|---|---|
| **Multi-Tenancy** | Every SQL query strictly enforces `WHERE user_id = :authenticated_user_id`. Cross-user access (IDOR) unconditionally yields `404 Not Found`. |
| **Authentication** | Passwords hashed using `bcrypt` (12 rounds). Stateless JWT access tokens (15-min expiry) with refresh token rotation. |
| **Pairing Tokens** | High-entropy single-use tokens hashed with bcrypt, bounded to 15-minute expirations. |
| **Rate Limiting** | Sliding-window limiter on `/register`, `/login`, `/refresh`, `/pair`, and `/events/batch`. |
| **CORS** | Strict whitelisting of configured production origins + authorized extension schemes (`chrome-extension://`, `moz-extension://`, `safari-web-extension://`). |
| **Error Sanitization** | Production 500 handler suppresses internal stack traces, DB connection strings, and credential leakage. |
| **Observability** | Per-request tracing via `X-Request-ID` and health endpoints (`/api/health`, `/api/health/db`, `/api/health/redis`). |

---

# ⚡ Verified Performance Benchmarks

Benchmarks executed against PostgreSQL 16 + pgvector with a scaled corpus of **100,000 events**:

| Scenario / Operation | p50 Latency | p95 Latency | p99 Latency | Throughput |
|---|---|---|---|---|
| **Ingestion (1,000 events, batch 50)** | 17.6 ms | 20.6 ms | 26.6 ms | 2,749.6 evt/sec |
| **Ingestion (10,000 events, batch 100)** | 29.8 ms | 35.2 ms | 43.4 ms | **3,227.1 evt/sec** |
| **Search: Keyword (Single Term)** | 3.0 ms | 9.5 ms | 19.1 ms | — |
| **Search: Keyword (Multi Term)** | 5.1 ms | 6.6 ms | 7.4 ms | — |
| **Search: Temporal ("yesterday")** | 4.4 ms | 6.8 ms | 8.0 ms | — |
| **Timeline (50 items, indexed backward scan)** | **0.3 ms** | **0.9 ms** | 4.9 ms | — |
| **Tenant Isolation Check (100k events)** | **0 leaks** | **0 leaks** | **0 leaks** | **100% Isolated** |

---

# 🧪 Running Automated Tests

Run the full pytest suite (17 comprehensive tests including multi-user SaaS end-to-end isolation):

```bash
cd apps/api
.venv/bin/python -m pytest tests/ -v
```

---

<p align="center">
  <b>Recall — Remember the web. Find it again.</b>
</p>


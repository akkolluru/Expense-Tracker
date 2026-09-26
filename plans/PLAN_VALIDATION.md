# Executive Audit Report: Documentation & Plan Validation

**Document**: `plans/PLAN_VALIDATION.md`  
**Repository**: `Expense Tracker (v2.0)`  
**Role**: Master Orchestrator & Technical Architect  
**Date**: 2026-09-25  

---

## 1. Audit Status & Gate Verdict

| Status | **APPROVED (Gate Cleared)** |
| :--- | :--- |
| **Gating Decision** | **PHASE 1 COMPLETE — PROCEED TO PHASE 2**. Architectural decisions, data contracts, and client specifications have been reviewed, clarified, and formally approved by the user. |

### Justification
While the core domain concepts (double-entry ledger invariants, immutable raw message staging, cross-channel UTR deduplication, and 4-tier decision cascade) are exceptionally well-conceived, **critical cross-document discrepancies and missing API/data contracts** will cause immediate rework and broken integration if implementation begins without resolution:
1. **Frontend Architecture Collision**: Multiple legacy v2 documents still specify a React Native (Expo) client (`react-native-gifted-charts`, `Expo SecureStore`), whereas later ADRs ([ADR 0005](file:///Users/kaushik/Projects/Expense%20Tracker/docs/adr/0005-pwa-deployment-model-with-paisaiq.md)), [PRD.md](file:///Users/kaushik/Projects/Expense%20Tracker/docs/PRD.md), and the repository artifact (`PaisaIQ Expense Tracker.zip`) mandate an offline-first **React 19 PWA (PaisaIQ)** with Tailwind CSS v4 and Recharts.
2. **Missing API Contracts**: Critical endpoints specified in [ARCHITECTURE.md](file:///Users/kaushik/Projects/Expense%20Tracker/docs/ARCHITECTURE.md) and [ROADMAP_AND_MILESTONES.md](file:///Users/kaushik/Projects/Expense%20Tracker/docs/ROADMAP_AND_MILESTONES.md)—specifically on-demand SMS parsing (`POST /api/v1/sync/parse-text`), server health check (`GET /api/v1/system/health`), and peer split settlements (`POST /api/v1/transactions/{id}/peer-splits`, `PATCH /api/v1/peer-splits/{id}/settle`)—are completely absent from [API_SPEC.md](file:///Users/kaushik/Projects/Expense%20Tracker/docs/API_SPEC.md).
3. **Data Model Gaps**: Missing linking foreign keys for peer settlements (`settlement_transaction_id` on `peer_splits`, `is_settlement` on `transactions`), unmodeled offline sync keys (`idempotency_key`), and potential category query contamination during `PENDING_REVIEW`.
4. **Workspace State**: The `v2-planning` branch lacks pinned dependency manifests (`pyproject.toml`, `requirements.txt`, `package.json`), while `PaisaIQ Expense Tracker.zip` remains unextracted in the repository root.

---

## 2. Dimensional Audit Findings

### Dimension 1: Completeness & Clarity
- **Frontend Divergence (High Severity)**:
  - *Current State*: [specs/0001-expense-tracker-v2-spec.md](file:///Users/kaushik/Projects/Expense%20Tracker/docs/specs/0001-expense-tracker-v2-spec.md), [MOBILE_APP_SPEC.md](file:///Users/kaushik/Projects/Expense%20Tracker/docs/MOBILE_APP_SPEC.md), [ADR 0002](file:///Users/kaushik/Projects/Expense%20Tracker/docs/adr/0002-mobile-app-and-group-analytics-architecture.md), and the Gantt chart in [ROADMAP_AND_MILESTONES.md](file:///Users/kaushik/Projects/Expense%20Tracker/docs/ROADMAP_AND_MILESTONES.md) reference a **React Native (Expo)** client.
  - *Intended State*: [ADR 0005](file:///Users/kaushik/Projects/Expense%20Tracker/docs/adr/0005-pwa-deployment-model-with-paisaiq.md), [PRD.md](file:///Users/kaushik/Projects/Expense%20Tracker/docs/PRD.md) (FR-7), [ARCHITECTURE.md](file:///Users/kaushik/Projects/Expense%20Tracker/docs/ARCHITECTURE.md), and [ADR 0009](file:///Users/kaushik/Projects/Expense%20Tracker/docs/adr/0009-offline-queue-and-sync-topology.md) supersede Expo in favor of **PaisaIQ: a responsive, offline-first Progressive Web Application (PWA)** built with React 19, TypeScript, and Tailwind CSS v4 (`#051F20` Forest Dark theme).
  - *Resolution*: Formally update all legacy references to establish the PaisaIQ React 19 PWA as the single authoritative client.
- **Peer Split Reimbursement & Settlement Mechanics (High Severity)**:
  - *Current State*: [ADR 0007](file:///Users/kaushik/Projects/Expense%20Tracker/docs/adr/0007-category-split-vs-peer-debt-split.md) describes peer splits where friend repayments link back to mark the debt paid without artificially inflating personal Income. However, neither [DATA_MODEL.md](file:///Users/kaushik/Projects/Expense%20Tracker/docs/DATA_MODEL.md) nor [API_SPEC.md](file:///Users/kaushik/Projects/Expense%20Tracker/docs/API_SPEC.md) models this link (`settlement_transaction_id` is missing).
  - *Resolution*: Add `settlement_transaction_id INTEGER FK -> transactions.id` to `peer_splits`, add `is_settlement BOOLEAN DEFAULT FALSE` to `transactions`, and define endpoints for recording peer splits and settlements.
- **Selective Learning & VPA Scoping Heuristics (Medium Severity)**:
  - *Current State*: [CATEGORIZATION_ENGINE.md](file:///Users/kaushik/Projects/Expense%20Tracker/docs/CATEGORIZATION_ENGINE.md) attempts to classify VPAs as "Commercial" vs "Personal Peer" based on handle suffixes (`@icici` vs `@okhdfcbank`, `@ybl`). In Indian UPI ecosystems, individuals and merchants interchangeably use `@ybl` and bank handles (e.g. `q816661384@ybl` is `JAI MATHA DI CHAT BHANDAR`). Suffix classification will produce false positives.
  - *Resolution*: Scope learned rules primarily via merchant name keywords (corporate suffixes, aggregator identifiers like `bharatpe.*`, `paytm.*`), and default `learn_merchant = False` for single-word or individual-name payees.
- **Cross-Channel Deduplication Window (Medium Severity)**:
  - *Current State*: [ADR 0006](file:///Users/kaushik/Projects/Expense%20Tracker/docs/adr/0006-cross-channel-deduplication-and-dual-ingestion.md) establishes a 48-hour matching window for UTRs. If background Gmail polling is suspended (e.g. host sleeping over a weekend), delayed emails may exceed 48 hours and fail deduplication against earlier SMS pastes.
  - *Resolution*: Extend UTR matching window to **7 days** (bank UTRs are globally unique per transaction; 7-day lookups carry zero collision risk).

---

### Dimension 2: Architecture Alignment
- **Missing API Specifications (High Severity)**:
  - `POST /api/v1/sync/parse-text` (Interactive SMS / alert string parsing with immediate UTR enrichment merge).
  - `GET /api/v1/system/health` (Server connectivity probe required by PWA offline queue to trigger automatic flush).
  - `POST /api/v1/transactions/{id}/peer-splits` and `PATCH /api/v1/peer-splits/{id}/settle`.
- **Suggested Category Storage & Review Invariants (Medium Severity)**:
  - *Finding*: When an LLM categorizes a transaction with low confidence (<0.70), status is `PENDING_REVIEW`. Writing the guess directly to `transactions.category_id` contaminates category analytics.
  - *Resolution*: Keep `category_id = NULL` while `status = 'PENDING_REVIEW'`. Introduce `suggested_category_id INTEGER FK -> categories.id (NULLABLE)`. On user approval in the review queue, copy `suggested_category_id` (or user override) to `category_id` and set `status = 'POSTED'`.
- **Offline Idempotency Key (Medium Severity)**:
  - *Finding*: [ADR 0009](file:///Users/kaushik/Projects/Expense%20Tracker/docs/adr/0009-offline-queue-and-sync-topology.md) specifies client-side UUID idempotency keys to prevent duplicate commits upon reconnection, but `transactions` in [DATA_MODEL.md](file:///Users/kaushik/Projects/Expense%20Tracker/docs/DATA_MODEL.md) lacks an `idempotency_key` column.
  - *Resolution*: Add `idempotency_key VARCHAR(64) UNIQUE` to `transactions` table.
- **Account Initial Balance Accounting (Low Severity)**:
  - *Finding*: Setting an account's `initial_balance` directly on row insert without an underlying ledger entry violates double-entry auditability.
  - *Resolution*: Automatically insert a system transaction (`description: "Opening Balance"`, `is_expense: False`, `is_transfer: False`, `status: "POSTED"`) when an account is created with an opening balance > 0.

---

### Dimension 3: Missing Dependencies & Operational Blockers
- **Monorepo Structure & Pinned Manifests (High Severity)**:
  - The repository root lacks `backend/` and `frontend/` folders, a `pyproject.toml`, and a `package.json`.
  - `PaisaIQ Expense Tracker.zip` must be extracted into `frontend/`, and Python dependencies must be pinned in `backend/pyproject.toml`.
- **SQLite Concurrency Under Background Poller & Backups (Medium Severity)**:
  - SQLite WAL mode allows concurrent readers, but strictly **one writer**. Background Gmail polling (every 15 min) or daily `VACUUM INTO` (2 AM) could block interactive user commits.
  - *Resolution*: Enforce `PRAGMA busy_timeout = 5000;` on all SQLite connections, wrap transactional writes in an async mutex (`asyncio.Lock()`), and acquire the write lock during the ~500ms `VACUUM INTO` routine.
- **Local LLM Fallback Latency (Medium Severity)**:
  - If local `llama-server` is unavailable or experiencing memory contention, waiting 3.0s per unmapped transaction across 20 batch emails causes a 60-second blocking stall.
  - *Resolution*: Introduce a **Stateful Circuit Breaker**: trip to OPEN on 2 consecutive local failures; bypass immediately to **Google Gemini 2.0 Flash** (<400ms); probe `http://127.0.0.1:8080/health` every 5 minutes to restore local routing.

---

## 3. Identified Gaps & Ambiguities Matrix

| ID | Severity | Document(s) | Description | Proposed Concrete Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **GAP-01** | **HIGH** | `MOBILE_APP_SPEC.md`, `specs/0001`, `ADR 0002/0004`, `ROADMAP_AND_MILESTONES.md` | React Native / Expo specified in earlier docs vs React 19 Tailwind v4 PWA (PaisaIQ) in later ADRs. | Update all specifications to standardize exclusively on **PaisaIQ React 19 PWA**. Supersede Expo references. |
| **GAP-02** | **HIGH** | `API_SPEC.md` | Missing `POST /api/v1/sync/parse-text` contract for on-demand SMS / alert string parsing. | Define endpoint contract in `API_SPEC.md` with payload, account context, and merge response schema. |
| **GAP-03** | **HIGH** | `DATA_MODEL.md`, `API_SPEC.md`, `ADR 0007` | Missing linking FK for settlement transactions and missing peer split CRUD / settlement endpoints. | Add `settlement_transaction_id` to `peer_splits`, `is_settlement` to `transactions`, and document peer split endpoints. |
| **GAP-04** | **HIGH** | `DATA_MODEL.md`, `API_SPEC.md`, `ADR 0009` | Missing `idempotency_key` in schema and API for offline queue re-synchronization. | Add `idempotency_key VARCHAR(64) UNIQUE` to `transactions` table and support `X-Idempotency-Key`. |
| **GAP-05** | **MEDIUM** | `CATEGORIZATION_ENGINE.md` | Ambiguous VPA scoping heuristics: handle suffixes (`@ybl`, `@icici`) fail to reliably detect commercial merchants. | Scope by corporate keywords and merchant gateway patterns; default toggle `learn_merchant = False` for ambiguous payees. |
| **GAP-06** | **MEDIUM** | `DATA_MODEL.md`, `API_SPEC.md` | Storing unapproved LLM category guesses in `category_id` risks contaminating category analytics. | Add `suggested_category_id` FK to `transactions`; keep `category_id = NULL` while `status = 'PENDING_REVIEW'`. |
| **GAP-07** | **MEDIUM** | `ARCHITECTURE.md`, `CATEGORIZATION_ENGINE.md` | Accumulation of 3.0s local LLM timeouts stalls batch ingestion when `llama-server` is down. | Implement a 2-strike stateful circuit breaker that routes directly to Gemini 2.0 Flash with background health recovery. |
| **GAP-08** | **MEDIUM** | `ARCHITECTURE.md`, `DATA_MODEL.md` | SQLite WAL single-writer contention between background pollers / backup workers and API requests. | Configure `PRAGMA busy_timeout = 5000` and wrap write transactions with an `asyncio.Lock()` in `LedgerService`. |
| **GAP-09** | **LOW** | Workspace Root | Unextracted `PaisaIQ Expense Tracker.zip` and missing pinned dependency manifests in git. | Scaffold `backend/` and `frontend/` monorepo layout; extract PaisaIQ; generate pinned `pyproject.toml`. |
| **GAP-10** | **LOW** | `SETUP.md`, `ROADMAP.md` | Legacy v1 documentation drift describing deprecated Python Flet UI and Termux. | Align `SETUP.md` with Docker/FastAPI + PWA, and deprecate root `ROADMAP.md` in favor of `docs/ROADMAP_AND_MILESTONES.md`. |
| **GAP-11** | **LOW** | `DATA_MODEL.md`, `API_SPEC.md` | Direct balance mutation on account creation without underlying ledger entry. | Automatically insert an "Opening Balance" ledger transaction upon account initialization. |

---

## 4. Proposed Concrete Resolutions & Schema Diffs

### 4.1 Schema DDL Extensions ([DATA_MODEL.md](file:///Users/kaushik/Projects/Expense%20Tracker/docs/DATA_MODEL.md))
```sql
-- 1. Support Peer Split Settlements
ALTER TABLE peer_splits ADD COLUMN settlement_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL;
CREATE INDEX idx_peer_splits_settlement ON peer_splits(settlement_transaction_id);

-- 2. Mark Settlement Transactions
ALTER TABLE transactions ADD COLUMN is_settlement BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Isolate AI Category Suggestions from Approved Categories
ALTER TABLE transactions ADD COLUMN suggested_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

-- 4. Enforce Offline Queue Idempotency
ALTER TABLE transactions ADD COLUMN idempotency_key VARCHAR(64) UNIQUE;
CREATE INDEX idx_transactions_idempotency ON transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;
```

### 4.2 Endpoint Contracts Added to [API_SPEC.md](file:///Users/kaushik/Projects/Expense%20Tracker/docs/API_SPEC.md)

#### 1. On-Demand SMS & Text Parsing: `POST /api/v1/sync/parse-text`
- **Request**:
  ```json
  {
    "raw_text": "Rs.311.00 debited from a/c **4762 to ZEPTO UPI Ref 127377523812",
    "source": "SMS",
    "account_id": 1
  }
  ```
- **Response (200 OK - Created or Enriched)**:
  ```json
  {
    "status": "MERGED",
    "action": "ENRICHMENT_MERGE",
    "transaction": {
      "id": 105,
      "reference_number": "127377523812",
      "amount": "311.00",
      "status": "POSTED",
      "merchant_name": "ZEPTO"
    }
  }
  ```

#### 2. Peer Split Allocation: `POST /api/v1/transactions/{id}/peer-splits`
- **Request**:
  ```json
  {
    "peer_splits": [
      { "member_name": "Rahul", "upi_id": "rahul@okhdfcbank", "share_amount": "400.00" },
      { "member_name": "Priya", "upi_id": "priya@okaxis", "share_amount": "400.00" }
    ]
  }
  ```

#### 3. Peer Debt Settlement: `PATCH /api/v1/peer-splits/{id}/settle`
- **Request**:
  ```json
  {
    "is_paid": true,
    "settlement_transaction_id": 120
  }
  ```

#### 4. Service Health Probe: `GET /api/v1/system/health`
- **Response (200 OK)**:
  ```json
  {
    "status": "HEALTHY",
    "database": "CONNECTED",
    "llm_circuit_breaker": "CLOSED",
    "timestamp": "2026-09-25T13:00:00Z"
  }
  ```

---

## 5. Confirmed Final Technical Stack

| Layer | Component | Version / Specification | Rationale & Configuration |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | **FastAPI** | `0.141.1` (Python 3.11) | Async REST architecture with automated OpenAPI documentation generation. |
| **Database & ORM** | **SQLite 3 + SQLAlchemy** | SQLAlchemy `2.0.51` + `aiosqlite` `0.22.1` | Zero-cloud, single-file DB with Write-Ahead Logging (`WAL`), `PRAGMA foreign_keys = ON`, `PRAGMA busy_timeout = 5000`, and `VACUUM INTO` snapshots. |
| **Schema Migrations** | **Alembic** | `1.19.0` | Controlled migrations for DDL schemas and compound performance indexes. |
| **Frontend Client** | **PaisaIQ PWA** | React `19.x`, Vite, TypeScript | Mobile-first Progressive Web Application with responsive phone/desktop layouts (`max-w-[430px]`). |
| **CSS & Design System** | **Tailwind CSS v4** | Tailwind `4.x` | Forest/Jade dark palette (`#051F20`, `#0B2B26`, `#DAF1DE`, `#8EB69B`). |
| **Visualizations** | **Recharts** | `2.x` | Interactive category distribution donut with top-5 spending drilldown modals. |
| **Client State & Cache**| **TanStack Query** | React Query `v5` + `IndexedDB` | Server-state caching and persistent offline action queue with UUID idempotency keys. |
| **AI / ML Primary** | **Local llama.cpp** | `Qwen2.5-1.5B-Instruct` (Q4_K_M GGUF) | 100% private, zero-latency local categorization via `http://127.0.0.1:8080`. |
| **AI / ML Fallback** | **Google Gemini API** | `gemini-2.0-flash` | Cloud fallback via Google AI Studio triggered by circuit breaker (<400ms latency). |
| **Background Scheduler**| **APScheduler** | `3.11.3` | Async in-process cron triggers for Gmail polling (15m), backup snapshots (2 AM), and health probes. |
| **Push Notifications** | **ntfy** | `ntfy.sh` (or self-hosted) | Instant push alerts for transactions requiring review (`PENDING_REVIEW`). |
| **Ingestion Protocols**| **Google API Client** | Gmail API (OAuth2) | Pluggable bank parser registry (HDFC UPI, HDFC Card, ICICI, Generic UPI). |
| **Security & Network** | **Tailscale Mesh VPN** | WireGuard point-to-point | Zero open public ports; client-to-host requests authenticated via `X-API-Key` headers. |

---

## 6. Phase 1 Gate Sign-Off & User Decisions (Confirmed)

The following architectural decisions have been formally approved by the user:

1. **Frontend Architecture**: Standardize exclusively on the **PaisaIQ React 19 PWA** (`React 19 + TypeScript + Vite + Tailwind CSS v4 + Recharts`). Deprecate and supersede all legacy React Native / Expo references across all specs and ADRs. Extract `PaisaIQ Expense Tracker.zip` into `frontend/`.
2. **Peer Debt Splitting & UPI Reimbursement**: Link incoming UPI debt repayments directly to `peer_splits` records as settlements using `is_settlement = TRUE` and `settlement_transaction_id` foreign key. Peer settlements offset receivables and do NOT inflate personal income.
3. **AI Categorization & Review Inbox**: When categorization confidence is $< 0.70$, keep `category_id = NULL` and store the model's guess in `suggested_category_id`. Transactions remain cleanly isolated until confirmed or edited by the user in the Inbox.
4. **Repository Structure**: Organize the repository as a clean monorepo with `backend/` (FastAPI + SQLite WAL + SQLAlchemy 2.0) and `frontend/` (PaisaIQ PWA), generating pinned dependency manifests (`pyproject.toml` and `package.json`) and archiving legacy v1 files.


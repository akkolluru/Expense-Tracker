# Phased Implementation Roadmap & Milestones
## Expense Tracker v2.0

---

## 1. Engineering Roadmap Overview

To ensure strict adherence to incremental software development and prevent regressions, implementation is structured across **7 atomic phases**:

```mermaid
gantt
    title Expense Tracker v2.0 Phased Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1: Database & Ledger
    Clean Schema & Models          :p1_1, 2026-09-01, 2d
    Alembic Migrations             :p1_2, after p1_1, 2d
    LedgerService & Invariants     :p1_3, after p1_2, 3d
    section Phase 2: Ingestion & Parsers
    Raw Staging Store & Hashes     :p2_1, after p1_3, 2d
    Pluggable BankParser Registry  :p2_2, after p2_1, 3d
    section Phase 3: AI Engine & Memory
    Deterministic Rule Engine      :p3_1, after p2_2, 2d
    Selective Merchant Memory      :p3_2, after p3_1, 2d
    Hybrid LLM (Qwen + Gemini)     :p3_3, after p3_2, 3d
    section Phase 4: Analytics & Groups
    Event Groups & Date Windows    :p4_1, after p3_3, 2d
    Indexed Analytics & Drilldown  :p4_2, after p4_1, 3d
    section Phase 5: PaisaIQ PWA Foundation
    React 19 & Forest Dark Theme   :p5_1, after p4_2, 3d
    PWA Shell & TanStack Query     :p5_2, after p5_1, 2d
    section Phase 6: Mobile Features
    Dashboard & Recent Ledger      :p6_1, after p5_2, 3d
    Inbox Triage & Selective Modal :p6_2, after p6_1, 3d
    Interactive Analytics Donut    :p6_3, after p6_2, 3d
    section Phase 7: Hardening & Packaging
    Zero-Downtime VACUUM Backups   :p7_1, after p6_3, 2d
    Tailscale & Docker Packaging   :p7_2, after p7_1, 2d
```

---

## 2. Phased Milestone Breakdown

### Phase 1: Database Schema & Multi-Account Ledger Core
- **Ticket 1.1: SQLAlchemy 2.0 Async Domain Models**
  - Implement models: `Account`, `Transaction`, `Split`, `Category`, `Group`, `Rule`, `MerchantMemory`, `RawMessage`, `CategorizationLog`.
  - Enforce foreign keys, cascade rules, and compound analytics indexes.
- **Ticket 1.2: Clean Alembic Migration Engine**
  - Create baseline migration script with SQLite foreign key pragmas and WAL journal mode.
- **Ticket 1.3: LedgerService & Invariant Validator**
  - Implement double-entry balance updates for `Expense`, `Income`, and `Transfer`.
  - Validate line-item splits ($\sum \text{Splits} = \text{Amount}$).
  - Comprehensive unit test suite for ledger invariants.

---

### Phase 2: Ingestion Staging & Pluggable Bank Parsers
- **Ticket 2.1: Immutable Staging Store**
  - Implement `raw_messages` persistence with SHA-256 deduplication hashing.
- **Ticket 2.2: BankParser Protocol & Registry**
  - Implement `BankParser` protocol and registry dispatcher.
  - Author `HdfcUpiParser` (email alert regex extraction).
  - Author `HdfcCardParser` (credit/debit card notification alerts).
  - Author `IciciAlertParser` and `GenericUpiParser`.
- **Ticket 2.3: Parser Fixture Regression Tests**
  - Build test suite against anonymized real email payloads.

---

### Phase 3: Multi-Tier Categorization & Hybrid AI Engine
- **Ticket 3.1: Tier 1 Deterministic Rule Engine**
  - Implement pattern matching for VPA regex, merchant substring, and amount limits.
- **Ticket 3.2: Tier 2 Merchant Memory with Selective Learning**
  - Implement normalized merchant key generation.
  - Implement conditional memory upsert based on `learn_merchant` flag.
- **Ticket 3.3: Tier 3 Hybrid LLM Client**
  - Implement primary local `llama.cpp` client (`Qwen2.5-1.5B`) with 3.0s timeout circuit breaker.
  - Implement secondary fallback to **Google Gemini 2.0 Flash** via Google AI Studio API.
  - Enforce structured JSON schema validation against database category IDs.
- **Ticket 3.4: Tier 4 Review Queue Routing**
  - Implement automatic routing of low-confidence ($< 0.70$) transactions to `PENDING_REVIEW`.

---

### Phase 4: Event Groups & Real-Time Analytics Engine
- **Ticket 4.1: Contextual Event Groups**
  - Implement date-window auto-assignment (`[start_date, end_date]`).
  - Implement manual group override and un-grouping capabilities.
- **Ticket 4.2: Real-Time Analytics Endpoints**
  - `GET /api/v1/analytics/summary` (Income, Burn rate, Savings rate).
  - `GET /api/v1/analytics/category-breakdown` (Category distributions).
  - `GET /api/v1/analytics/category/{id}/drilldown` (Top 5 largest spends).
  - `GET /api/v1/analytics/mom-comparison` (Month-over-Month variance).

---

### Phase 5: PaisaIQ PWA Integration & Foundation
- **Ticket 5.1: PaisaIQ React 19 Frontend Ingestion & Build Pipeline**
  - Integrate the PaisaIQ React 19 + TypeScript + Tailwind CSS v4 application into the monorepo (`frontend/`).
  - Configure PWA manifest, viewport meta (`max-w-[430px]` mobile mode), and Vite build scripts.
- **Ticket 5.2: API Client (`api.ts`) & TanStack Query Setup**
  - Implement typed Axios / Fetch client with `X-API-Key` headers and Tailscale endpoint configuration.
  - Configure TanStack Query with local storage cache persistence.
- **Ticket 5.3: Responsive Shell & Navigation**
  - Wire 4-tab mobile navigation (`Home`, `Inbox`, `Expenses`, `Analytics`) and quick action modals.

---

### Phase 6: PaisaIQ Live Screen Binding & Feature Integration
- **Ticket 6.1: HomeView Live Binding**
  - Bind Available Balance hero card, monthly burn progress, savings rate, and recent ledger feed to `/api/v1/analytics/summary` and `/api/v1/transactions`.
- **Ticket 6.2: InboxView Triage & Selective Learning**
  - Add **Selective Learning Checkbox** ("Remember for future transactions") to the review card.
  - Wire one-tap confirm, category picker grid, and raw SMS snippet toggle to `/api/v1/inbox`.
- **Ticket 6.3: ExpensesView & TransactionDetailDrawer with Peer Splits**
  - Connect full search, category filter chips, and payment mode filters.
  - Wire `TransactionDetailDrawer` for category overrides and multi-member peer debt splits (`peer_splits`).
- **Ticket 6.4: AnalyticsView Recharts Visualizations**
  - Bind Recharts cash flow breakdowns, category distribution donut, and daily burn rate chart to live analytics endpoints.
- **Ticket 6.5: AddTransactionModal Live Bank SMS Ingestion**
  - Wire "Smart Bank SMS Parser" tab to backend `POST /api/v1/sync/parse-text` with instant cross-channel UTR deduplication.

---

### Phase 7: Hardening, Background Schedulers & Deployment
- **Ticket 7.1: Zero-Downtime Backups**
  - Scheduled daily 2:00 AM `VACUUM INTO` backup worker.
- **Ticket 7.2: Unified Push Notifications**
  - `ntfy.sh` integration for inbox alerts and spending anomaly warnings.
- **Ticket 7.3: Docker & Tailscale Packaging**
  - Create production multi-stage `Dockerfile` and `docker-compose.yml`.
  - Document zero-port-forwarding Tailscale setup.

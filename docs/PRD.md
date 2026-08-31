# Product Requirements Document (PRD)
## Expense Tracker v2.0: Self-Hosted Personal Financial Intelligence

---

## 1. Executive Summary & Vision

### 1.1 Mission
To provide individuals with a **100% private, self-hosted, automated personal finance ledger and expense intelligence system** designed specifically for modern transaction ecosystems (e.g. Indian UPI payments, multi-bank notifications, multi-card setups, and manual cash adjustments).

### 1.2 Core Value Proposition
1. **Absolute Data Sovereignty**: Zero third-party cloud data exposure. All bank alerts, SMS payloads, and financial records reside solely on the user's private server/container.
2. **True Multi-Account Ledger**: Accurate accounting separating expenses from intra-account transfers (e.g., credit card bill payoffs, savings-to-current transfers, cash withdrawals) to eliminate distorted burn rates.
3. **Multi-Tier Deterministic & Hybrid AI Categorization**: A layered engine prioritizing instant user rules and auto-learning *Merchant Memory* (with selective learning toggles) before falling back to a structured JSON local or remote LLM, followed by an inbox review queue.
4. **Contextual Event & Trip Isolation**: Dedicated event *Groups* (e.g. "Goa Trip 2026", "Apartment Setup") driven by active date windows, allowing vacation spending to be analyzed in isolation without corrupting year-round category totals.
5. **Native Mobile Ergonomics**: A fluid, responsive cross-platform mobile client (React Native / Expo) featuring an OLED dark theme, interactive pie/donut charts with instant top-5 transaction drilldowns, and one-tap inbox triage.

---

## 2. User Personas & Problem Scenarios

### 2.1 Target User Personas

| Persona | Characteristics | Core Pain Points Addressed |
| :--- | :--- | :--- |
| **The Privacy-Conscious Power User** | Hosts self-hosted services (Docker, Home Assistant, Tailscale), values financial data privacy, avoids commercial banking aggregator apps that sell data. | No telemetry, local-first database, Tailscale end-to-end encryption, Qwen2.5 local LLM option. |
| **The Multi-Account Indian Spender** | Uses multiple bank accounts (e.g. HDFC, ICICI), multiple credit cards, and heavy daily UPI payments. | Ingestion parses Indian bank formats automatically; intra-account transfers don't inflate monthly spending. |
| **The Trip & Event Organizer** | Travels frequently or runs distinct personal projects (vacations, home renovation) and needs to budget events separately. | Contextual *Groups* auto-claim expenses within a date range with zero category taxonomy contamination. |

### 2.2 Key Problem Scenarios in Existing Tools
- **The Transfer Distortion Trap**: Transferring ₹50,000 from Savings to ICICI Credit Card is logged as a ₹50,000 expense, doubling apparent monthly expenditure.
- **The Vendor Memory Amnesia**: Manually categorizing "Swiggy UPI" to "Food & Dining > Food Delivery" 50 times because the tool fails to auto-learn merchant mappings.
- **Friend Transfer Pollution**: Sending ₹2,000 to a friend for movie tickets permanently maps that friend's UPI VPA to "Entertainment", wrongly categorizing future rent splits.
- **Cloud Dependency & Security Risks**: Handing Gmail OAuth credentials to commercial SaaS platforms that parse bank emails on external servers.
- **Flat Inflexible Tagging**: Inability to see "How much did I spend on Food specifically during the Goa trip?" without breaking overall monthly Food totals.

---

## 3. Product Principles & Guardrails

1. **Zero Data Leakage**: Financial transaction logs, bank account numbers, and merchant descriptions must never leave the self-hosted environment unless explicitly configured for remote LLM inference (Google Gemini) with strict sanitization.
2. **Deterministic Precedence**: Code rules and verified merchant memories always override stochastic AI predictions.
3. **Double-Entry Accuracy**: Every movement of funds is attributed to an explicit source and/or destination Account with validated balance math.
4. **Immutable Ingestion Staging**: Raw notification payloads are preserved verbatim in an append-only store to enable deterministic historical re-parsing whenever bank email templates change.
5. **Mobile-First Triage**: Clearing the transaction review queue must require minimal cognitive load—actionable with single-tap gestures on mobile.

---

## 4. Functional Requirements

### FR-1: Multi-Account Ledger & Transaction Management
- **FR-1.1**: The system shall support multiple distinct `Account` records, each defined by name, institution (e.g., `HDFC`, `ICICI`, `SBI`, `CASH`), account type (`SAVINGS`, `CREDIT_CARD`, `WALLET`, `CASH`, `INVESTMENT`), and currency (`INR`).
- **FR-1.2**: The system shall support three distinct transaction directions/semantics:
  - `Expense`: Outflow from an Account to an external merchant (`is_expense=True`). Decreases account balance and contributes to monthly burn rate.
  - `Income`: Inflow into an Account from an external source (`is_expense=False`). Increases account balance.
  - `Transfer`: Outflow from `source_account_id` and simultaneous inflow to `destination_account_id` (`is_expense=False`). Atomically updates both balances without counting towards monthly expense or income totals.
- **FR-1.3**: The system shall support line-item `Split` records for any transaction, allowing an expense (e.g., ₹3,000 supermarket purchase) to be distributed across multiple categories (e.g., ₹2,200 Groceries, ₹800 Home Supplies), with strict validation that $\sum \text{Split amounts} = \text{Transaction amount}$.
- **FR-1.4**: The system shall support manual cash transaction entry and manual balance adjustments.

### FR-2: Immutable Raw Message Staging & Deduplication
- **FR-2.1**: The ingestion worker shall store all incoming emails, SMS alerts, and CSV rows in an immutable `raw_messages` table with raw headers, raw body, source type, and timestamp.
- **FR-2.2**: The system shall generate a deterministic cryptographic hash (`sha256(source + external_id + payload_summary)`) for each ingested message. Duplicate hashes shall be rejected immediately at the database level (`UNIQUE constraint`), preventing duplicate transactions.
- **FR-2.3**: Staged raw messages shall transition through states: `INGESTED` $\rightarrow$ `PARSED` $\rightarrow$ `FAILED_TO_PARSE` $\rightarrow$ `RE_PARSED`.
- **FR-2.4**: The system shall provide an administrative endpoint/script to re-run parsers across historical `raw_messages` when parser algorithms are updated.

### FR-3: Pluggable Bank Parser Registry
- **FR-3.1**: Bank parsers shall adhere to a strict `BankParser` protocol providing `can_handle(raw_message) -> bool` and `parse(raw_message) -> list[DraftTransaction]`.
- **FR-3.2**: The parser registry shall provide pre-built parsers for:
  - **HDFC Bank UPI Alerts**: Email alerts from `alerts@hdfcbank.net` parsing amount, payee/merchant name, VPA, reference number, closing balance, and timestamp.
  - **HDFC Bank Card Alerts**: Debit and Credit card point-of-sale and online transaction alerts.
  - **ICICI Bank Alerts**: ICICI debit/credit and UPI notification templates.
  - **Generic UPI Parser**: Fallback regex extractor for standardized Indian UPI SMS/email formats.
  - **CSV Bank Statement Importer**: Configurable column-mapping parser for CSV exports.
- **FR-3.3**: Parsers shall extract structured `DraftTransaction` objects with normalized merchant strings, account identifiers (e.g. `last4`), reference numbers, and transaction types.

### FR-4: Multi-Tier Hybrid Categorization Engine
- **FR-4.1 (Tier 1 - Rule Engine)**: Evaluate active `Rule` records with exact or regex matching against VPA, merchant name substring, or amount criteria. If matched, assign category with `confidence = 1.0` and source `RULE`.
- **FR-4.2 (Tier 2 - Merchant Memory with Selective Learning)**:
  - Query persistent `merchant_memories` by exact VPA or normalized merchant key.
  - When approving or editing a transaction in the Inbox or Ledger, the UI shall present a **"Remember for future transactions"** toggle.
  - If toggle is ON, the system automatically inserts/updates `MerchantMemory`.
  - If toggle is OFF (e.g. sending money to a friend's personal VPA for a one-off item), the category is saved for this transaction only without polluting the memory cache.
- **FR-4.3 (Tier 3 - Hybrid LLM Engine)**:
  - If unmatched by Tier 1 or Tier 2, invoke the LLM with a strict JSON output schema.
  - **Provider Hierarchy**: Local `llama.cpp` instance running `Qwen2.5-1.5B-Instruct` on `localhost:8080`. If local instance is unavailable or times out (>3.0s), automatically fallback to **Google Gemini API** (`gemini-2.0-flash`) via Google AI Studio.
  - **Strict Schema Enforcement**: The prompt provides the full flat list of existing valid `category_id` values. The LLM must return `{ "category_id": int, "confidence": float, "reasoning": str }`.
- **FR-4.4 (Tier 4 - Inbox Triage Queue)**:
  - If LLM confidence is below threshold ($< 0.70$), or if the transaction is ambiguous, flag status as `PENDING_REVIEW` and place in the Review Inbox.
  - Allow the user to review, approve with one tap, or re-assign category with instant search.

### FR-5: Contextual Event Groups & Trip Tracking
- **FR-5.1**: Users can create a `Group` defined by `name` (e.g. "Goa Trip 2026"), `description`, `start_date`, `end_date`, and optional `budget`.
- **FR-5.2 (Date-Window Auto-Assignment)**: During ingestion, any transaction occurring with timestamp $\in [\text{start\_date}, \text{end\_date}]$ of an active group shall be automatically linked (`group_id = group.id`).
- **FR-5.3 (Manual Overrides & Independence)**: Users can manually add, remove, or reassign a transaction to/from a Group at any time. Un-grouping a transaction leaves its Category untouched.
- **FR-5.4 (1:1 Invariant)**: Each transaction belongs to at most one Group at any given time.
- **FR-5.5 (Group Analytics)**: Provide dedicated group metrics: Total Spent, Budget Variance, Category Breakdown within the Group, and Daily Spend Velocity.

### FR-6: Real-Time Analytics & Spending Intelligence
- **FR-6.1 (Summary Metrics)**: On-demand real-time calculation of Monthly Income, Monthly Burn Rate, Net Savings, and Savings Rate.
- **FR-6.2 (Category Breakdown & Donut Chart)**: Aggregated category totals for any selected calendar month, quarter, or custom date range.
- **FR-6.3 (Interactive Top-5 Drilldown)**: Selecting any category slice in the distribution chart returns the **Top 5 largest transactions** in that category for the period.
- **FR-6.4 (Month-over-Month Comparisons)**: Calculate percentage change ($\Delta\%$) and absolute change ($\Delta ₹$) per category compared to the prior month (e.g. "Dining Out: ₹14,200 vs ₹10,500 last month, $+35.2\%$").
- **FR-6.5 (Spending Pattern Anomaly Detection)**: Flag categories or merchants where spending velocity exceeds $1.25\times$ the 3-month rolling average.

### FR-7: Cross-Platform Native Mobile Client (React Native / Expo)
- **FR-7.1**: Native mobile app for Android and iOS built with React Native and Expo in strict TypeScript.
- **FR-7.2 (Design System)**: Deep OLED Dark Mode interface with `#090A0F` background, `#131620` card surfaces, `#8B5CF6` accent purple, `#10B981` positive green, and `#F43F5E` negative red.
- **FR-7.3 (Screens)**:
  - `HomeScreen`: Net Worth header, Monthly Burn summary, Quick Add Cash FAB, Recent Transactions feed.
  - `InboxScreen`: Pending review cards, confidence chips, one-tap approval button, quick category picker, selective memory toggle.
  - `LedgerScreen`: Paginated infinite-scroll transaction list, search by merchant/note, multi-filter drawer (Date, Account, Category, Group, Type).
  - `AnalyticsScreen`: Donut chart, interactive slice tap, Top-5 drilldown modal, MoM comparison list, Group expense filter.
  - `SettingsScreen`: Account balances, active Rules, Gmail Sync trigger, LLM health check, Tailscale connectivity.
- **FR-7.4 (Offline Caching)**: Cache recent transactions and monthly analytics in local storage (AsyncStorage / TanStack Query cache) for instant offline viewing.

### FR-8: System Architecture, Backup & Security
- **FR-8.1**: Headless FastAPI REST backend running inside a lightweight Docker container.
- **FR-8.2**: Database powered by SQLite 3 in Write-Ahead Logging (`WAL`) mode with foreign key enforcement (`PRAGMA foreign_keys = ON;`).
- **FR-8.3 (Zero-Downtime Backup)**: Automated daily 2:00 AM backup using `VACUUM INTO` to produce consistent point-in-time database snapshots into a mounted backup volume.
- **FR-8.4 (Authentication & Security)**: All REST endpoints secured by header `X-API-Key`. The mobile client stores the key in platform encrypted storage (Expo SecureStore). Communication routed over **Tailscale Mesh VPN** to ensure zero open public internet ports.
- **FR-8.5 (Push Notifications)**: Unified push notification worker using `ntfy.sh` (or self-hosted ntfy instance) alerting the user when high-value transactions or review-pending items arrive.

---

## 5. Non-Functional Requirements (NFRs)

| ID | Category | Requirement Description | Target Metric |
| :--- | :--- | :--- | :--- |
| **NFR-1** | **Privacy & Sovereignty** | No financial payload or account identifier sent to public clouds without user opt-in. | 0 telemetry calls, 100% self-hosted |
| **NFR-2** | **Query Latency** | Direct SQL aggregation queries for dashboard analytics and drilldowns. | $< 50\text{ ms}$ for 50,000 transactions |
| **NFR-3** | **Categorization Latency** | Tier 1 (Rules) and Tier 2 (Memory) resolve without LLM invocation. | $< 5\text{ ms}$ response time |
| **NFR-4** | **LLM Fallback Timeout** | Circuit breaker on local LLM before falling back to Gemini API. | 3.0s max timeout before Gemini |
| **NFR-5** | **Mobile App Fluidity** | UI frame rendering speed and startup time on modern Android/iOS devices. | 60 fps animations, $< 1.5\text{s}$ cold launch |
| **NFR-6** | **Database Portability** | Single-file SQLite database with zero external database server dependency. | Runs on Raspberry Pi 4, Mac, or x86 VPS |

---

## 6. System Invariants & Guardrails

1. **Transfer Zero-Sum Invariant**: For any Transfer transaction between Account $A$ and Account $B$:
   $$\Delta \text{Balance}(A) = -\text{Amount}, \quad \Delta \text{Balance}(B) = +\text{Amount}, \quad \Delta \text{Net Worth} = 0, \quad \text{Expense} = 0$$
2. **Split Balance Invariant**: For any transaction with $N$ splits ($N \ge 1$):
   $$\sum_{i=1}^{N} \text{Split.amount}_i = \text{Transaction.amount}$$
3. **Group Independence Invariant**: Deleting or archiving a `Group` must never delete the underlying transactions; it simply clears `group_id = NULL`.
4. **Category Deletion Guardrail**: A `Category` cannot be deleted if transactions or splits reference it (`ON DELETE RESTRICT`). It must first be reassigned.
5. **Raw Message Immutability**: Rows in `raw_messages` are append-only. They are never updated or deleted during standard operations.

---

## 7. Success Metrics & Acceptance Criteria

- **Rule & Memory Hit Rate**: $> 85\%$ of regular monthly transactions categorized deterministically by Tiers 1 and 2 with zero LLM latency.
- **Inbox Review Friction**: Average review inbox backlog maintained at $< 3$ pending items per week.
- **Ingestion Accuracy**: $100\%$ precision on amount, transaction reference, and account attribution across tested bank alert formats.
- **Ledger Invariant Compliance**: $0$ ledger balance discrepancies across accounts over all transactions and transfers.

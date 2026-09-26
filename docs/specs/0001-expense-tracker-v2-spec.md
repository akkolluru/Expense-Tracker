# Specification: Redesigned Expense Tracker (v2.0)

## Problem Statement

Users managing personal finances across multiple bank accounts (savings, credit cards, UPI, cash) currently lack an automated, privacy-first ledger that accurately parses raw bank notifications without cloud exposure. In previous iterations:
- Raw bank emails were coupled directly to single-entry database rows, discarding raw payloads and making retroactive parsing improvements impossible.
- Intra-account movements (e.g. paying a credit card bill via UPI or withdrawing cash) were incorrectly logged as expenses, distorting cash flow metrics.
- LLM categorization was slow, non-deterministic, and frequently failed to resolve category IDs, creating unnecessary manual review inbox clutter.
- Users could not isolate event- or trip-based spending (e.g. "Goa Trip" or "Night Out") while simultaneously maintaining long-term category reporting.
- The UI relied on high-overhead desktop wrappers that lacked native mobile ergonomics, fluid charts, and category drill-downs.

## Solution

A headless, self-hosted containerized personal finance backend paired with an offline-first Progressive Web Application (**PaisaIQ: React 19 + TypeScript + Tailwind CSS v4**). The system provides:
1. **Multi-Account Ledger**: Full multi-account support with explicit `Expense`, `Income`, and `Transfer` semantics and line-item `Split` capability.
2. **Immutable Raw Message Ingestion**: Decoupled staging of raw incoming communications (Gmail API, SMS, CSV) with cryptographic de-duplication and a pluggable bank parser registry.
3. **Multi-Tiered Deterministic Categorization**: A strict categorization hierarchy prioritizing user-defined rules and auto-learning `Merchant Memory` to resolve 80-90% of transactions with zero latency, falling back to a structured JSON LLM schema only when needed.
4. **Contextual Group Tracking**: Dedicated 1:1 `Group` assignments driven by active date windows (e.g. vacation dates) with instant manual overrides.
5. **Real-Time Analytics & Drilldowns**: Real-time SQL aggregations offering interactive category pie charts, top-5 transaction drill-downs, Month-over-Month (MoM) comparisons, and spending pattern change detection.

---

## User Stories

### Ingestion & Bank Parsing
1. As a user, I want the system to poll my configured bank email account periodically in the background, so that I do not have to manually record daily UPI and card transactions.
2. As a user, I want all incoming emails to be stored in an immutable staging store before parsing, so that if a bank changes its email template, old emails can be re-parsed without re-fetching from Gmail.
3. As a user, I want duplicate emails or repeated webhooks to be ignored via cryptographic payload hashes, so that my ledger never contains duplicate transactions.
4. As a user, I want distinct bank parser plugins for my bank accounts (e.g. HDFC UPI, HDFC Debit/Credit Card, ICICI), so that varying email schemas are cleanly extracted into standardized draft transactions.
5. As a user, I want bank transactions to map strictly to my configured accounts using account numbers, so that funds are attributed to the correct financial bucket.

### Multi-Account Ledger & Transfers
6. As a user, I want to manage multiple accounts (Savings, Credit Cards, Cash), so that I can see the balances and liabilities of each institution in one place.
7. As a user, I want to log transfers between my own accounts (e.g. paying my credit card bill from my savings account), so that the movement does not count as an expense or inflate my monthly burn rate.
8. As a user, I want to split a single transaction across multiple categories (e.g. a grocery store purchase covering food and household items), so that my budget tracking is accurate.
9. As a user, I want to record manual cash transactions and adjust account balances, so that non-digital spending is included in my overall ledger.

### Categorization & Merchant Memory
10. As a user, I want custom pattern-matching rules (matching VPA, merchant name, or description keywords), so that known recurring expenses are categorized immediately without AI overhead.
11. As a user, I want the system to automatically remember my manual category approvals and changes in a Merchant Memory cache, so that the next time I spend at the same merchant, it is automatically categorized with 100% confidence.
12. As a user, I want unmapped merchants to be classified by a local or remote LLM returning strict category identifiers, so that novel transactions are categorized without name resolution errors.
13. As a user, I want ambiguous or low-confidence transactions to land in an Inbox for manual review, so that incorrect machine guesses do not corrupt my ledger.
14. As a user, I want to review, approve, or re-categorize pending inbox transactions with single-tap gestures on my phone, so that clearing my review queue is effortless.

### Event Groups & Trip Tracking
15. As a user, I want to create a Group with a date range and budget (e.g. "Goa Trip 2026", Aug 10–15), so that all spending during that event is tracked collectively.
16. As a user, I want transactions occurring within an active Group's date range to be auto-assigned to that Group, so that I don't have to manually tag every holiday purchase.
17. As a user, I want the ability to manually remove or reassign a transaction from an auto-assigned Group, so that personal or work expenses during a trip are excluded from the trip total.
18. As a user, I want a transaction to belong to at most one Group while retaining its independent Category, so that my overall category analytics remain intact.
19. As a user, I want dedicated group statistics (total spent vs budget, category breakdown within the group), so that I can track event costs in isolation.

### Analytics, Drill-Downs & Trends
20. As a user, I want an interactive pie/donut chart on my mobile app showing category-wise spending for any selected month or date range, so that I understand where my money goes.
21. As a user, I want to tap on any category slice in the pie chart to reveal the top 5 largest transactions in that category, so that I can immediately inspect the major drivers of spend.
22. As a user, I want to see Month-over-Month (MoM) variance comparisons per category (e.g. "Dining Out +35% vs last month"), so that I am alerted to shifting spending habits.
23. As a user, I want spending pattern change heuristics (e.g. spending velocity spikes > 1.25x rolling average, new recurring merchants), so that anomalies are highlighted before month-end.

### Mobile Client Experience & Security
24. As a user, I want a native mobile app on my phone with smooth animations and instant loading, so that checking my finances feels fast and responsive.
25. As a user, I want cached local state on the mobile app, so that I can view my recent transactions and analytics even when my phone is temporarily offline.
26. As a user, I want the mobile client to communicate securely with my self-hosted Docker container over Tailscale using an API key stored in my phone's secure keystore, so that my financial data never traverses public unencrypted clouds.

---

## Implementation Decisions

### Architectural Seams & Modules

1. **Staging & Ingestion Seam**:
   - `IngestionWorker`: Connects to external providers (Gmail API) using async thread execution; writes incoming payloads verbatim into `raw_messages`.
   - `BankParserRegistry`: Evaluates candidate parsers using `can_handle(raw_message)` and produces `list[DraftTransaction]` via `parse(raw_message)`.

2. **Categorization & Enrichment Pipeline Seam**:
   - Pure decision pipeline `CategorizationEngine.evaluate(draft)`:
     - Step 1: Evaluates active `Rule` records (VPA / regex / keyword).
     - Step 2: Queries `MerchantMemory` by normalized merchant key.
     - Step 3: Invokes `LLMClient` with a strict JSON schema output constraint (`category_id` enum validation).
     - Step 4: Falls back to `PENDING_REVIEW` if confidence < threshold.
   - Evaluates `GroupAssignor`: Checks if `draft.timestamp` falls within any active `Group(start_date, end_date)`.

3. **Ledger & Persistence Seam**:
   - `LedgerService`: Manages transactional writes to `accounts`, `transactions`, and `splits`. Enforces balance adjustments and double-entry transfer invariants.
   - On manual transaction review or category modification, `LedgerService` calls `MerchantMemoryService.upsert_memory(merchant_key, category_id, sub_category_id)`.

4. **Analytics & Aggregation Seam**:
   - `AnalyticsService`: Executes direct indexed SQL aggregations across `transactions` with compound indexes on `(timestamp, category_id, group_id, account_id)`.
   - Produces category distributions, top-N drilldowns, MoM deltas, and statistical pattern anomaly flags in single sub-millisecond queries.

5. **API & Client Interface**:
   - Headless FastAPI REST service with OpenAPI schema generation.
   - Offline-first PaisaIQ React 19 PWA client consuming typed endpoints via TanStack Query and rendering charts via `Recharts`.

---

## Testing Decisions

### Testing Philosophy & Seams
All automated tests must test external behavioral contracts at the highest available seam rather than mocking internal private methods.

1. **Ingestion & Parser Test Suite**:
   - Test against fixtures of real bank email payloads (anonymized HDFC UPI, HDFC Card, ICICI emails).
   - Assert that raw messages transition from `INGESTED` to `PARSED` and generate correct `DraftTransaction` fields (amount, direction, reference number, merchant name, timestamp).
2. **Categorization Engine Test Suite**:
   - Test rule matching priority over merchant memory.
   - Test merchant memory auto-learning: assert that updating a transaction's category creates/updates the memory cache and deterministically classifies the next identical transaction.
   - Test mock LLM structured JSON response handling and fallback on low confidence or timeouts.
3. **Ledger & Invariant Test Suite**:
   - Test transfer transactions: assert source and destination account balances update accurately without creating phantom expense records.
   - Test transaction splits: assert line items validate total transaction amount.
   - Test group auto-assignment: assert transactions occurring within trip dates link to the group, and manual un-grouping leaves category intact.
4. **Analytics & Aggregation Test Suite**:
   - Test MoM delta math, category pie calculations, and top-5 sorting against deterministic seeded datasets.

---

## Out of Scope

1. **Multi-User / Family Ledgers**: The v2.0 release is strictly optimized for single-user deployment with private API key authentication. Multi-user tenancy and shared ledgers will be addressed in a future milestone.
2. **Automated Bank Scraping / Direct Banking APIs**: Due to regulatory and security constraints (2FA / Captchas), ingestion relies exclusively on email/SMS notifications and manual/CSV imports.
3. **AI Financial Wrapped / Story Recaps**: AI-generated monthly/annual story cards are deferred to Phase 2 after the core ingestion, ledger, group management, and analytics are fully operational.
4. **In-App Payment Execution**: The application is strictly a read-and-track ledger; it will not initiate or execute financial payments.

---

## Further Notes

- **Database Engine**: SQLite 3 with Write-Ahead Logging (`WAL`) mode enabled, bundled in a mounted Docker volume for zero-maintenance, single-file backups via `VACUUM INTO`.
- **API Security**: Endpoints protected by `X-API-Key` headers; Tailscale handles network isolation and end-to-end device encryption.
- **Portability**: The backend container runs identically across Linux homelabs, Raspberry Pi, macOS, and Termux/Docker environments.

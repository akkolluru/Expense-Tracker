# 09 — FastAPI REST Endpoints & Health Probe

**What to build:**  
The complete REST API layer exposing all backend domain services over HTTP. Implements strict `X-API-Key` authentication, optional `X-Idempotency-Key` headers for safe retry semantics, interactive SMS/text ingestion (`POST /api/v1/sync/parse-text`), review inbox endpoints, and the server health probe (`GET /api/v1/system/health`) required by the PWA service worker.

**Blocked by:**  
- 03 — Cross-Channel UTR Deduplication & Enrichment Merge
- 05 — Hybrid LLM Categorization & Circuit Breaker
- 07 — Real-Time Analytics & Drilldowns
- 08 — Peer Debt Splits & Settlements

**Status:** ready-for-agent

- [x] Security dependency validating incoming `X-API-Key` header against `SERVER_API_KEY` environment variable (returning 401 Unauthorized on mismatch).
- [x] Idempotency middleware checking `X-Idempotency-Key` / payload `idempotency_key` against `transactions.idempotency_key` to prevent duplicate ledger inserts on network retries.
- [x] Endpoints implemented per `docs/API_SPEC.md`:
  - `GET /api/v1/accounts`, `POST /api/v1/accounts`
  - `GET /api/v1/transactions`, `POST /api/v1/transactions`, `POST /api/v1/transactions/{id}/split`
  - `POST /api/v1/transactions/{id}/peer-splits`, `GET /api/v1/peer-splits/receivables`, `PATCH /api/v1/peer-splits/{id}/settle` (Out of Core Loop scope)
  - `GET /api/v1/inbox`, `POST /api/v1/inbox/{id}/approve`
  - `GET /api/v1/categories/tree`, `GET /api/v1/groups/{id}/summary` (Out of Core Loop scope)
  - `GET /api/v1/analytics/summary`, `GET /api/v1/analytics/category/{id}/drilldown`, `GET /api/v1/analytics/mom-comparison` (Out of Core Loop scope)
  - `POST /api/v1/sync/parse-text`
  - `GET /api/v1/system/health`
- [x] Integration test suite in `backend/tests/test_api_v1.py` executing full end-to-end API tests using FastAPI `httpx.AsyncClient`.

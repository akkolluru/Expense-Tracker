# Group Lifecycle, Merchant Memory, and Client-Server Topology

Establishes deterministic auto-assignment of Groups by date windows, immediate-overwrite Merchant Memory learning, and a centralized server-side ingestion and analytics model consumed by an Android client.

## Context & Problem
Transactions need contextual event grouping (e.g. trips, projects) without compromising orthogonal category classifications. Categorization needs to learn immediately from user overrides without repeatedly invoking the LLM, and mobile clients need fast, responsive consumption without complex 2-way database synchronization.

## Decision
1. **Centralized Server Ingestion & Analytics**: The backend (FastAPI in Docker) handles all asynchronous bank ingestion, scheduled polling, deterministic rule matching, merchant memory caching, and heavy analytical aggregations. The mobile app acts as an API client.
2. **Date-Window Group Auto-Assignment with Manual Overrides**: An active `Group` with a date range `[start_date, end_date]` automatically claims incoming transactions within that window. Users can re-assign or un-group transactions at any time.
3. **Immediate Merchant Memory Updates**: When a user assigns or edits a transaction category, `MerchantMemory` is immediately updated in the database, ensuring all subsequent transactions from the same merchant/VPA are deterministically categorized without LLM inference.
4. **Phased Roadmap for AI Recaps**: Focus Phase 1 on bulletproof ledger, multi-bank ingestion, categorization, groups, and real-time analytics; defer periodic AI recap stories to Phase 2.

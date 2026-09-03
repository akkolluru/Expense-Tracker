# Offline Queue and Client-to-Host Synchronization Topology

To ensure uninterrupted transaction recording when disconnected from the private host server, the PaisaIQ PWA implements an optimistic client-side Offline Queue using browser IndexedDB with automatic background synchronization upon reconnection.

## Context & Problem
The Expense Tracker backend runs on a private host machine (e.g. laptop, home server, or dedicated phone) accessible over Tailscale. When the user is outside network coverage or their primary device is not actively connected to the Tailscale mesh, network requests to the backend fail.

A personal finance tracker must never block or lose a user's expense entry at the point of sale. If a user cannot quickly record a cash payment or paste an SMS notification while paying at a shop, the transaction will likely be forgotten.

## Decision
1. **Host-Authoritative Client-Server Model**: The containerized FastAPI service on the host machine remains the authoritative source of truth.
2. **IndexedDB Offline Queue**:
   - The PaisaIQ PWA utilizes an offline action queue backed by browser `IndexedDB`.
   - When the PWA is offline (or the backend endpoint is unreachable), new manual cash transactions and pasted SMS drafts are committed to the local queue.
   - The UI optimistically displays these records with an amber **"Pending Sync"** badge so the user has immediate visual confirmation of the recorded spend.
3. **Automatic Reconnection Flush**:
   - The PWA monitors browser network events (`window.addEventListener('online', ...)`) and periodically pings the backend `/api/v1/system/health` endpoint.
   - Once connectivity is re-established, the queue flushes pending items sequentially to `POST /api/v1/transactions` and `POST /api/v1/sync/parse-text`.
4. **Idempotency Safeguards**:
   - Every queued transaction is stamped with a client-generated UUID/idempotency key (`idempotency_key`).
   - If a network drop occurs mid-sync and the client retries, the backend uses the idempotency key to prevent duplicate ledger rows.

# 10 — PaisaIQ PWA API Client & Offline Queue

**What to build:**  
The client-side API transport and offline persistence foundation for the PaisaIQ PWA (`frontend/`). Establishes a typed TanStack Query client communicating with the backend over Tailscale with `X-API-Key`. Implements a browser `IndexedDB` offline action queue that buffers manual transactions and pasted SMS drafts when offline, automatically flushing them upon network reconnection.

**Blocked by:**  
- 09 — FastAPI REST Endpoints & Health Probe

**Status:** ready-for-agent

- [ ] Typed API client (`frontend/src/api/client.ts`) configured with `VITE_API_URL` (Tailscale host) and `VITE_API_KEY`.
- [ ] TanStack Query (`@tanstack/react-query`) provider configured in `frontend/src/App.tsx` with query caching and stale-time defaults.
- [ ] Browser `IndexedDB` offline queue (`frontend/src/utils/offlineQueue.ts`) storing queued actions with client-generated UUID `idempotency_key`.
- [ ] Reconnection listener: listens to `window.ononline`, polls `GET /api/v1/system/health`, and flushes queued mutations with optimistic cache reconciliation.
- [ ] Connection status pill in the PWA header (Green = Connected, Amber = Offline / Syncing).
- [ ] Frontend unit tests for offline buffer and queue flush in `frontend/src/__tests__/offlineQueue.test.ts`.

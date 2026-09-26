# 12 — Production Hardening & Schedulers

**What to build:**  
Production schedulers, push notifications, and container packaging for self-hosted homelab or cloud VPS deployment. Configures APScheduler for periodic 15-minute background Gmail polling and scheduled daily 2:00 AM `VACUUM INTO` zero-downtime database backups. Integrates `ntfy.sh` for instant review queue notifications, and provides production `Dockerfile` and `docker-compose.yml`.

**Blocked by:**  
- 09 — FastAPI REST Endpoints & Health Probe

**Status:** ready-for-agent

- [ ] APScheduler initialized with `AsyncIOScheduler`:
  - 15-minute background Gmail poller job with async thread execution.
  - Daily 2:00 AM database backup job executing `VACUUM INTO` to `/backups/expense_tracker_YYYYMMDD_HHMMSS.db` with rotation (keep last 30 daily backups).
- [ ] Concurrency safety: ensure database write lock (`asyncio.Lock()`) is held during backup snapshot to prevent `database is locked` contention with API writers.
- [ ] Push notifications client (`app/services/notifications.py`) sending instant alerts to `ntfy.sh` when transactions land in `PENDING_REVIEW`.
- [ ] Multi-stage `Dockerfile` packaging both FastAPI backend and pre-built PaisaIQ static assets into a single lightweight container image.
- [ ] `docker-compose.yml` specifying volume mounts for `/data` (SQLite DB) and `/backups`, with Tailscale sidecar or host network instructions.
- [ ] End-to-end container verification test.

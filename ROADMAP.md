# Expense Tracker: Future Planning & Roadmap

This document outlines the planned improvements, known issues, and future direction for the next version of the Self-Hosted Expense Tracker.

## 🟡 Known Advisories (To be fixed in upcoming iterations)

These are real issues identified during the initial development phases that do not crash the app, but should be addressed for better stability and scalability:

1. **Email Fetcher Sync Blocking**: Gmail API calls (`messages.list().execute()`) are currently making **blocking synchronous** calls inside async functions. This should be wrapped in `asyncio.to_thread()` or moved to an async Google API client. (Works fine for a personal tracker currently since the scheduler runs sequentially).
2. **OAuth Token Refresh**: Refreshed Gmail OAuth tokens are not currently re-encrypted and saved back. If your token refreshes after the original encrypts, you might need to manually re-run `gmail_auth.py`. 
3. **Backup Completeness**: The current `shutil.copy2` mechanism in `backup.py` only copies the main `.db` file, omitting the WAL/SHM files. This is generally acceptable for personal use (writes are rare during the 2 AM backup), but for bulletproof backups, we should switch to `VACUUM INTO` or the `sqlite3` backup API.
4. **CORS Specification Violation**: `main.py` uses `allow_origins=["*"]` + `allow_credentials=True` which violates the CORS spec. Since you are behind Tailscale, browsers won't enforce this strictly, but if the app is exposed to the public web, explicit origins must be set.
5. **Push Notification Character Encoding**: `httpx` headers encoded with `.encode("utf-8")` bytes may cause issues with special characters in `notifications.py`. Best to avoid emojis in ntfy titles (emojis work fine in the body and tags).

---

## 🚀 Planned Features for Next Version (v2.0)

1. **Multi-Bank Support**: Currently, only HDFC UPI emails are parsed. The next version will add parsers for SBI, ICICI, Axis, and credit card statements using a modular plugin-like parsing architecture.
2. **Multi-User Capabilities**: Add the ability for multiple users (e.g., family members) to track expenses in the same database. This will include isolated views or a shared family ledger, along with distinct OAuth configurations.
3. **Advanced Analytics & Export**: 
   - Add detailed, interactive charts for cash flow trends over time.
   - Custom date range filtering in the analytics dashboard.
   - Capability to export transactions to CSV, Excel, or PDF.
4. **Budgeting System**: Introduce monthly budgets per category with push notifications alerting users when they approach or exceed limits.
5. **UI & UX Enhancements**: Refine the Flet UI for improved mobile responsiveness. Add a dark mode toggle and streamline the transaction manual review workflow to make categorization faster.
6. **Dockerization**: Create a `Dockerfile` and `docker-compose.yml` for easier deployment on systems outside of Termux (like Raspberry Pi, homelab servers, or VPS).

# 11 — PaisaIQ Screens Live Binding & Triage UI

**What to build:**  
Connect all extracted PaisaIQ screens and interactive drawers to the live backend API. Users can view live balances on `HomeView`, review and triage pending items with selective learning in `InboxView`, inspect and filter transactions with peer debt management in `ExpensesView` and `TransactionDetailDrawer`, and explore spending distributions and top-5 drilldowns in `AnalyticsView`.

**Blocked by:**  
- 10 — PaisaIQ PWA API Client & Offline Queue

**Status:** closed

- [x] `HomeView`: Bind Available Balance, Monthly Burn rate progress bar, Savings Rate badge, and Recent Ledger to live queries (`/api/v1/analytics/summary` and `/api/v1/transactions`).
- [x] `InboxView`: Bind pending items from `/api/v1/inbox`. Implement one-tap Approve with the **"Remember for future transactions"** selective memory checkbox, category picker grid, and raw SMS snippet toggle.
- [x] `ExpensesView`: Connect real-time search debounce, category filter chips, and paginated transaction list.
- [x] `TransactionDetailDrawer`: Enable editing category splits, adding notes, and configuring multi-member peer debt splits (`POST /api/v1/transactions/{id}/peer-splits`) with one-tap "Paid" settlement toggles.
- [x] `AnalyticsView`: Bind Recharts cash flow breakdowns and category distribution donut to `/api/v1/analytics/categories`. Wire interactive donut slice tap to open the Top-5 Largest Spends modal (`/api/v1/analytics/categories/{id}/top-spends`).
- [x] `AddTransactionModal`: Wire manual transaction entry and Smart Bank SMS tab (`POST /api/v1/sync/parse-text`) with instant feedback on created vs merged status.
- [x] Frontend end-to-end component verification: run `npm run build` and `npm test` in `frontend/`.


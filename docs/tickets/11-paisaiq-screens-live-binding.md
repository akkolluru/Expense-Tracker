# 11 — PaisaIQ Screens Live Binding & Triage UI

**What to build:**  
Connect all extracted PaisaIQ screens and interactive drawers to the live backend API. Users can view live balances on `HomeView`, review and triage pending items with selective learning in `InboxView`, inspect and filter transactions with peer debt management in `ExpensesView` and `TransactionDetailDrawer`, and explore spending distributions and top-5 drilldowns in `AnalyticsView`.

**Blocked by:**  
- 10 — PaisaIQ PWA API Client & Offline Queue

**Status:** ready-for-agent

- [ ] `HomeView`: Bind Available Balance, Monthly Burn rate progress bar, Savings Rate badge, and Recent Ledger to live queries (`/api/v1/analytics/summary` and `/api/v1/transactions`).
- [ ] `InboxView`: Bind pending items from `/api/v1/inbox`. Implement one-tap Approve with the **"Remember for future transactions"** selective memory checkbox, category picker grid, and raw SMS snippet toggle.
- [ ] `ExpensesView`: Connect real-time search debounce, category filter chips, and paginated transaction list.
- [ ] `TransactionDetailDrawer`: Enable editing category splits, adding notes, and configuring multi-member peer debt splits (`POST /api/v1/transactions/{id}/peer-splits`) with one-tap "Paid" settlement toggles.
- [ ] `AnalyticsView`: Bind Recharts cash flow breakdowns and category distribution donut to `/api/v1/analytics/category-breakdown`. Wire interactive donut slice tap to open the Top-5 Largest Spends modal (`/api/v1/analytics/category/{id}/drilldown`).
- [ ] `AddTransactionModal`: Wire manual transaction entry and Smart Bank SMS tab (`POST /api/v1/sync/parse-text`) with instant feedback on created vs merged status.
- [ ] Frontend end-to-end component verification: run `npm run build` and `npm run lint` in `frontend/`.

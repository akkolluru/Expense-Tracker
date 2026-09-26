# 00 — PaisaIQ UI/UX Design System & Interactive Prototype

**What to build:**  
Run and refine the standalone interactive PaisaIQ frontend prototype in `frontend/`. Users can test and review the live screen layouts (`HomeView`, `InboxView`, `ExpensesView`, `AnalyticsView`), evaluate the Forest/Jade Dark Theme (`#051F20`, `#0B2B26`, `#DAF1DE`, `#8EB69B`), test mobile phone ergonomics (`max-w-[430px]` center canvas vs wide view), inspect Recharts interactive animations, and refine modal/drawer flows (e.g. peer debt splits and smart SMS parsing) before backend wiring.

**Blocked by:** None — can start immediately (independent design & frontend track).

**Status:** ready-for-agent

- [ ] Frontend dependencies installed and dev server starts cleanly (`npm run dev`) on `http://localhost:3000` with zero TypeScript or bundling errors.
- [ ] Review all 4 core screen designs against mockup samples in `UI Designs/`:
  - `HomeView`: Net worth hero balance, burn velocity progress bar, savings rate badge, and quick ledger feed.
  - `InboxView`: Review card triage, confidence pill, selective learning checkbox ("Remember for future transactions"), and raw SMS snippet toggle.
  - `ExpensesView`: Search debounce, category filter chips, and transaction list.
  - `AnalyticsView`: Interactive Recharts donut chart with smooth hover/tap states and top-5 category drilldown bottom sheet.
- [ ] Validate responsive viewport toggles: mobile phone shell (`max-w-[430px]`) with smooth transition to wide desktop canvas.
- [ ] Test and polish `TransactionDetailDrawer`: category selection grid, notes input, and multi-member peer debt splits (`SplitMember`) with "Paid" settlement toggle.
- [ ] Test and polish `AddTransactionModal`: manual entry tab and smart bank SMS paste tab.
- [ ] Finalize color palette tokens, typography hierarchy, and animations based on user review and design iteration.

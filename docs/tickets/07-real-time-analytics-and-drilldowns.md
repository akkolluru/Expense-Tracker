# 07 — Real-Time Analytics & Drilldowns

**What to build:**  
Direct indexed SQL analytics engine capable of sub-50ms execution on single-board hardware. Produces real-time monthly cash flow metrics (Income, Personal Burn Rate, Savings Rate), category distribution breakdowns for donut visualizations, Month-over-Month (MoM) category variance comparisons, and top-5 largest individual transactions per category.

**Blocked by:**  
- 01 — Core Multi-Account Ledger & Invariants
- 06 — Event Groups & Trip Budgets

**Status:** ready-for-agent

- [ ] `AnalyticsService.get_monthly_summary(month: str)` calculating:
  - Total Income: all posted, non-transfer, non-settlement inflows.
  - Personal Monthly Burn: all posted outflows minus any peer receivables.
  - Net Savings and Savings Rate percentage.
- [ ] `AnalyticsService.get_category_breakdown(month: str, group_id: Optional[int])` grouping category spend with percentages and color metadata.
- [ ] `AnalyticsService.get_category_drilldown(category_id: int, month: str, limit: int = 5)` returning the top N largest spends.
- [ ] `AnalyticsService.get_mom_comparison(current_month: str, previous_month: str)` calculating delta amounts, percentage shifts, and UP/DOWN trend flags.
- [ ] Exclusion invariant: ensure `PENDING_REVIEW` transactions and `is_settlement = TRUE` transactions never pollute category distributions.
- [ ] Performance and math test suite in `backend/tests/test_analytics.py` verifying SQL queries execute against compound indexes with zero N+1 queries.

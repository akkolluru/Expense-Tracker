# 08 — Peer Debt Splits & Settlements

**What to build:**  
Social bill splitting and debt tracking. When paying for a group expense, users can split liability among peers (Split Members). The user's personal monthly burn rate reflects only their personal share. When a friend reimburses their share via UPI, the system records it as a debt settlement (`is_settlement = TRUE`) linked to the `peer_splits` row, marking the debt paid without artificially inflating monthly income.

**Blocked by:**  
- 01 — Core Multi-Account Ledger & Invariants
- 07 — Real-Time Analytics & Drilldowns

**Status:** ready-for-agent

- [ ] `peer_splits` model and table with `transaction_id`, `member_name`, `upi_id`, `share_amount`, `is_paid`, `settlement_transaction_id`, and `settled_at`.
- [ ] Invariant check: $\sum \text{share\_amount} \le \text{transaction.amount}$. Personal share is $\text{transaction.amount} - \sum \text{share\_amount}$.
- [ ] Outstanding receivables query: `get_outstanding_receivables()` returning all unpaid peer splits grouped by member or transaction.
- [ ] Settlement mechanism: `settle_peer_split(peer_split_id, settlement_tx_id)` sets `is_paid = TRUE`, `settled_at = timestamp`, and `settlement_transaction_id = settlement_tx_id`.
- [ ] Settlement transaction invariant: verify that incoming settlement transactions (`is_settlement = TRUE`) increase account balance but are strictly omitted from `total_income` in analytics.
- [ ] Test suite in `backend/tests/test_peer_splits.py` verifying debt allocation, reimbursement linking, and income preservation.

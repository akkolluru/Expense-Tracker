# 03 — Cross-Channel UTR Deduplication & Enrichment Merge

**What to build:**  
A dual-channel reconciliation engine that eliminates duplicate transactions across fast (SMS) and background (Gmail) channels. If an SMS is parsed and later a bank email arrives with the same UTR (within a 7-day sliding window), the system executes a non-destructive `Enrichment Merge`—updating missing metadata (account number, closing balance, branch memo) without modifying approved categories, splits, notes, or groups.

**Blocked by:**  
- 02 — Pluggable Raw Staging & Multi-Bank Parsers

**Status:** ready-for-agent

- [ ] Deduplication lookup querying `transactions.reference_number == draft.reference_number` within a 7-day window.
- [ ] Fallback deduplication signature `(amount == draft.amount AND abs(timestamp - draft.timestamp) <= 10m)` when reference number is missing.
- [ ] Non-destructive enrichment merge logic:
  - If existing transaction is found: populate missing fields (`account_id`, `raw_message_id`, `reference_number`), preserve existing `category_id`, `splits`, `group_id`, and `notes`.
  - Mark raw message as `PARSED` and link it to the existing transaction.
- [ ] If no existing transaction matches: commit new transaction to the staging/ledger pipeline.
- [ ] Comprehensive test suite in `backend/tests/test_deduplication.py` testing SMS-first then Email-second, and Email-first then SMS-second arrival sequences.

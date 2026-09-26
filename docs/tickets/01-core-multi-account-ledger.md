# 01 — Core Multi-Account Ledger & Invariants

**What to build:**  
The foundational multi-account ledger engine. Users can configure distinct accounts (Savings, Credit Cards, Cash), and the system records immutable double-entry `Expense`, `Income`, and `Transfer` transactions with line-item category splits. The ledger strictly enforces that transfers do not alter net worth, opening balances create audit transactions, and line splits equal the transaction total.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] SQLAlchemy 2.0 async domain models implemented: `Account`, `Transaction`, `Category`, `Split`, `Rule`, `MerchantMemory`, `RawMessage`, `CategorizationLog`, `Group`, `PeerSplit`.
- [ ] SQLite connection initialized with `PRAGMA journal_mode = WAL;`, `PRAGMA foreign_keys = ON;`, and `PRAGMA busy_timeout = 5000;`.
- [ ] Alembic migration environment initialized under `backend/` with a baseline migration reflecting all DDL tables and compound indexes.
- [ ] `LedgerService.create_account` automatically creates an "Opening Balance" posted system transaction when `initial_balance > 0`.
- [ ] `LedgerService.record_transaction` executes balance updates atomically:
  - `Expense`: deducts from `account_id`.
  - `Income`: adds to `account_id`.
  - `Transfer`: deducts from `account_id` and adds to `destination_account_id`.
- [ ] `LedgerService.split_transaction` validates that $\sum \text{Splits} = \text{amount}$ and rolls back atomically on mismatch.
- [ ] Automated pytest suite in `backend/tests/test_ledger.py` verifying all balance and split invariants.

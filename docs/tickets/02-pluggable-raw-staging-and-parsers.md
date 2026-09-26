# 02 — Pluggable Raw Staging & Multi-Bank Parsers

**What to build:**  
An immutable staging store and extensible bank parser pipeline. When raw email or SMS notifications arrive, they are saved verbatim into `raw_messages` with SHA-256 cryptographic deduplication. A `BankParserRegistry` evaluates candidate parsers to normalize raw messages into standardized `DraftTransaction` objects (amount, direction, reference number, merchant name, timestamp).

**Blocked by:**  
- 01 — Core Multi-Account Ledger & Invariants

**Status:** ready-for-agent

- [x] `RawMessage` ingestion helper computing `SHA-256(raw_body)` and rejecting duplicate payloads idempotently.
- [x] `BankParser` protocol defined with `can_handle(raw_message: RawMessage) -> bool` and `parse(raw_message: RawMessage) -> list[DraftTransaction]`.
- [x] `HdfcUpiParser` authored to extract UPI transactions from HDFC notification emails (amount, payee name, VPA, UTR).
- [x] `HdfcCardParser` authored to extract credit/debit card swipe alerts.
- [x] `IciciAlertParser` and `GenericUpiParser` fallback authored for common SMS formats.
- [x] Account resolution logic matching extracted account identifiers (last 4 digits) to configured `accounts.account_number_last4`.
- [x] Parser regression test suite in `backend/tests/test_parsers.py` running against anonymized fixture samples from `Examples of mails`.

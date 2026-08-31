# Multi-Account Ledger & Raw Ingestion Staging

To eliminate coupling and enable multi-bank ingestion, the system separates raw external signals from domain transactions using an immutable `Raw Message` staging store, and models finances as a multi-account ledger supporting transfers, bank institutions, and line-item splits.

## Context & Problem
In the original implementation, the email polling service was tightly coupled to SQLite writes and directly generated flat single-entry transactions. This prevented supporting multiple accounts, intra-account transfers (e.g. paying credit card bills), and re-parsing historical emails when parsing logic improved.

## Decision
1. **Raw Message Staging**: External notifications (emails, SMS, CSV files) are stored verbatim in an immutable staging table before parsing. Parsers act as pure extractors yielding draft transactions, enabling deterministic replayability and bank parser extensions without re-fetching from source APIs.
2. **Multi-Account Model**: Every transaction belongs to an `Account` tied to an institution (e.g. HDFC, ICICI, Cash). Transfers link a source and destination account without distorting cash flow metrics.
3. **Line-Item Splits**: Transactions can be split across multiple categories or subcategories.

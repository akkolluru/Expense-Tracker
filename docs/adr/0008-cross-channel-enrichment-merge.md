# Cross-Channel Enrichment Merge on Bank UTR Collision

To handle out-of-order dual alerts (instant SMS paste followed by automated Gmail sync), the system performs non-destructive enrichment merges when an incoming notification matches an existing transaction by Bank Reference Number (UTR).

## Context & Problem
When a user pays at a merchant, they may immediately paste the bank SMS alert into the PaisaIQ `AddTransactionModal` to record the expense on the spot. The transaction is posted with extracted fields (amount, short merchant name, UTR). 

Minutes later, the background `GmailPoller` fetches the official bank email for the same transaction. The email typically contains richer metadata: full merchant corporate name, branch location, verified account number (`last4`), and closing account balance.

If the incoming email is rejected as a duplicate, this valuable verified metadata is lost. If it is inserted as a new transaction, the user's ledger balances are corrupted with duplicate debits.

## Decision
1. **UTR Collision Detection**: When parsing any incoming notification (email or SMS), the ingestion pipeline checks if `reference_number` already exists in `transactions`.
2. **Non-Destructive Enrichment**: If a match is found:
   - The new raw payload is preserved in `raw_messages` with status `MERGED`.
   - The existing `transactions` record is updated with any missing or higher-fidelity attributes:
     - Verified `account_id` (if the email provides `account_number_last4` that the SMS lacked).
     - Full merchant string (stored in notes/description if different).
     - Running account balance snapshot.
   - **Preservation Invariant**: The existing transaction's `category_id`, `splits`, `peer_splits`, `group_id`, and user notes are **strictly preserved** and never overwritten by the automated email.
3. **Audit Trail**: The transaction references both raw messages via an audit log or junction link, guaranteeing complete traceabilty back to source signals.

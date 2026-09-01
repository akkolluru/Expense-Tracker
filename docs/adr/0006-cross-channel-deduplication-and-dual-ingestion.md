# Cross-Channel Deduplication and Dual Ingestion Pipeline

To combine zero-effort background tracking with instant on-demand entry, the system implements a dual ingestion pipeline (background Gmail polling + interactive SMS paste) safeguarded by strict cross-channel UTR and financial signature deduplication.

## Context & Problem
Transactions can be captured via two separate external mediums:
1. **Background Gmail Polling**: Automated polling of bank notification emails every 15 minutes.
2. **On-Demand SMS Parsing**: Immediate manual paste of a bank SMS or WhatsApp transaction alert into the PaisaIQ `AddTransactionModal`.

If a user pastes an SMS alert immediately after a purchase and the background Gmail poller subsequently fetches the corresponding bank email 10 minutes later, standard message-hash deduplication fails because the raw email payload differs completely from the raw SMS text. Without domain-level deduplication, duplicate transactions would corrupt ledger balances.

## Decision
1. **Two-Stage Deduplication**:
   - **Stage 1 (Raw Payload Hash)**: `raw_messages.payload_hash` prevents repeated ingestion of identical emails or repeated SMS pastes at the staging store level (`SHA256(source + external_id + payload)`).
   - **Stage 2 (Cross-Channel Financial Signature)**: Before committing a draft transaction into `transactions`, the ledger checks for existing transactions within a sliding 48-hour window matching:
     $$\text{Reference Number (UTR)} \quad \lor \quad (\text{amount} = A \land \text{account\_id} = B \land |\Delta t| \le 10 \text{ minutes})$$
2. **Transaction Enrichment on Collision**:
   - If an incoming Gmail alert matches an existing SMS-created transaction via UTR, the engine does not create a duplicate row. Instead, it enriches the existing record (linking the new `raw_message_id`, updating verified merchant details or closing balance) while keeping existing category assignments and splits untouched.
3. **Audit Trail**: Both raw messages remain persisted in `raw_messages`, preserving an immutable log of both alerts.

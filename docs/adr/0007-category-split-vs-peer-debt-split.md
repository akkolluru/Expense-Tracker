# Category Split vs Peer Debt Split Disambiguation

To preserve budgeting precision while enabling social group bill splitting, the system separates multi-category classification ("Category Split") from multi-person liability attribution ("Peer Split / Settlement").

## Context & Problem
In personal expense management, the word "split" is overloaded:
1. **Category Split**: A single ₹3,000 supermarket bill covers ₹2,200 of Groceries and ₹800 of Household Items. All ₹3,000 is the user's personal expense, but distributed across budget categories.
2. **Peer Debt Split**: A user pays a ₹1,200 restaurant bill for 3 friends (₹400 user's share, ₹400 friend A, ₹400 friend B). The user's actual personal expense is only ₹400. The remaining ₹800 is an asset/receivable owed to the user. Logging ₹1,200 as personal expense distorts monthly burn rate and budget tracking.

## Decision
1. **Disambiguated Domain Entities**:
   - `splits` (Category Splits): Relates `transaction_id` to multiple `category_id` rows, where $\sum \text{Split.amount} = \text{Transaction.amount}$. Used for budget and category distribution analytics.
   - `peer_splits` (Peer Splits): Relates `transaction_id` to multiple `SplitMember` records (`name`, `upi_id`, `share_amount`, `is_paid`).
2. **Net Burn Math**:
   - When a transaction has active `peer_splits`, the user's effective monthly burn is calculated as:
     $$\text{Personal Expense} = \text{Transaction.amount} - \sum_{\text{others}} \text{PeerSplit.share\_amount}$$
   - Amounts owed by others are categorized as pending receivables.
3. **Settlement Tracking**:
   - When a peer repays their share via UPI (e.g. friend transfers ₹400), the incoming transaction can be linked to the pending `peer_split` as a `Settlement`. This marks `is_paid = TRUE` and offsets the receivable balance without inflating the user's personal "Salary / Income" metric.

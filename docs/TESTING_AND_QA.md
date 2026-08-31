# Testing Strategy & Quality Assurance Guide
## Expense Tracker v2.0

---

## 1. Testing Philosophy & Architecture Seams

All tests in Expense Tracker v2.0 follow a strict **behavioral contract** testing strategy at explicit architectural seams rather than mocking private implementation details.

```
       / \
      / E2E \       - Full API Integration & Ingestion Pipeline
     /-------\
    / Seam    \     - Invariant Testing, Parser Fixtures, Fallback Matrices
   /-----------\
  / Pure Logic  \   - Rule Engine, Math Invariants, Hash Deduplication
 /---------------\
```

---

## 2. Invariant & Accounting Test Suite

### 2.1 Double-Entry Balance Invariants
Tests must assert mathematical consistency across all transaction mutations:

1. **Expense Invariant**:
   - Creating an expense of ₹$X$ from Account $A$ must decrement $\text{Balance}(A)$ by exactly $X$.
   - Must increase monthly expense total by $X$.
   - Must leave other account balances unmodified.
2. **Income Invariant**:
   - Creating an income of ₹$Y$ into Account $B$ must increment $\text{Balance}(B)$ by exactly $Y$.
   - Must increase monthly income total by $Y$.
3. **Transfer Invariant**:
   - Creating a transfer of ₹$Z$ from Account $A$ to Account $B$ must decrement $\text{Balance}(A)$ by $Z$ and increment $\text{Balance}(B)$ by $Z$.
   - Total net worth across all accounts must remain strictly identical: $\Delta \text{Net Worth} = 0$.
   - Monthly expense and monthly income must remain unmodified ($\Delta \text{Burn} = 0$).
4. **Split Balance Validation**:
   - A transaction of ₹3,000 split into [₹1,500, ₹1,000, ₹500] must succeed.
   - A transaction of ₹3,000 split into [₹1,500, ₹1,000] (sum = 2,500) must raise a `ValidationError (422)`.
   - Modifying the parent transaction amount must invalidate or require updating split line items.

---

## 3. Bank Parser Regression Test Suite

Parsers must be tested against **real-world anonymized fixtures** representing Indian bank email formats:

| Fixture File | Source Format | Assertions |
| :--- | :--- | :--- |
| `hdfc_upi_debit.eml` | HDFC Bank UPI Debit Alert | Amount `450.00`, VPA `swiggy@icici`, Last4 `9482`, Ref `424918294821`, Status `INGESTED` $\rightarrow$ `PARSED` |
| `hdfc_upi_credit.eml` | HDFC Bank UPI Credit Alert | Amount `1200.00`, Payee `RAHUL SHARMA`, IsExpense `False`, Last4 `9482` |
| `hdfc_card_debit.eml` | HDFC Bank Credit Card Alert | Amount `3400.00`, Merchant `TOSCANO RESTAURANT`, Card Last4 `1044`, IsExpense `True` |
| `icici_bank_debit.eml` | ICICI Bank Debit Alert | Amount `1800.00`, Merchant `AMAZON PAY`, Account Last4 `5512` |
| `duplicate_message.eml`| Repeated Delivery of Same Alert | SHA-256 hash collision; DB enforces `UNIQUE` constraint; second message ignored cleanly |

---

## 4. Categorization Engine Hierarchy Test Matrix

The categorization test suite evaluates the 4-tier decision cascade:

```
+-------------------------------------------------------------------------------+
| Scenario                   | Expected Strategy | Expected Category | Conf     |
+----------------------------+-------------------+-------------------+----------+
| 1. Matches active Rule     | RULE              | Rule Assigned     | 1.0      |
| 2. Known Merchant Memory   | MERCHANT_MEMORY   | Memory Assigned   | 1.0      |
| 3. Rule vs Memory conflict | RULE              | Rule Assigned     | 1.0      |
| 4. New Merchant (Local LLM)| LOCAL_LLM         | Qwen Assigned     | >= 0.70  |
| 5. Local LLM timeout/down  | GEMINI_LLM        | Gemini Assigned   | >= 0.70  |
| 6. Low confidence (< 0.70) | REVIEW_QUEUE      | None (Pending)    | < 0.70   |
| 7. Corrupted LLM response  | REVIEW_QUEUE      | None (Pending)    | 0.0      |
+-------------------------------------------------------------------------------+
```

### Selective Memory Learning Tests:
1. Approve review transaction with `learn_merchant = True`:
   - Assert `merchant_memories` row is inserted.
   - Ingest identical draft transaction; assert it resolves immediately via `MERCHANT_MEMORY` with zero LLM calls.
2. Approve review transaction with `learn_merchant = False`:
   - Assert `merchant_memories` row is NOT inserted.
   - Ingest identical draft transaction; assert it is evaluated by LLM / review queue.

---

## 5. Analytics SQL Aggregation & Performance Benchmarks

- **Dataset Size**: Benchmark against a seeded SQLite database containing **50,000 historical transactions** and **10,000 splits**.
- **Benchmark Target**:
  - `GET /api/v1/analytics/summary` (Monthly burn + income): $< 15\text{ ms}$
  - `GET /api/v1/analytics/category-breakdown` (Donut distribution): $< 25\text{ ms}$
  - `GET /api/v1/analytics/category/{id}/drilldown` (Top 5 largest spends): $< 10\text{ ms}$
  - `GET /api/v1/analytics/mom-comparison` (MoM variance across all categories): $< 35\text{ ms}$

---

## 6. Mobile Client UI / UX Verification Checklist

- [ ] **OLED Dark Mode**: Background `#090A0F`, card contrast ratio $\ge 4.5:1$ against text.
- [ ] **Chart Gesture Responsiveness**: Donut slices trigger drilldown modal on first tap with smooth entrance animation.
- [ ] **One-Tap Inbox Clearance**: Approving an inbox item removes the card optimistically with haptic feedback and zero UI flicker.
- [ ] **Offline Resilience**: Turn off network/Tailscale; app launches and renders cached ledger and charts without a crash or blocking spinner.
- [ ] **Secure Storage**: Verify `X-API-Key` is persisted in Android Keystore / iOS Keychain via `Expo SecureStore`.

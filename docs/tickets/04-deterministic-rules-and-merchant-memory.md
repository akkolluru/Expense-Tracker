# 04 — Deterministic Rules & Merchant Memory

**What to build:**  
The first two tiers of the automated categorization cascade. Tier 1 matches deterministic user-configured rules (exact VPA, regex, merchant substring, amount thresholds). Tier 2 checks persistent `merchant_memories` using normalized merchant keys. When users manually confirm or modify a transaction's category with the selective learning flag enabled, the system upserts the merchant memory for zero-latency future matching.

**Blocked by:**  
- 01 — Core Multi-Account Ledger & Invariants

**Status:** ready-for-agent

- [x] `RuleEngine` evaluating active rules in order of `priority` (lower integer = higher priority).
- [x] Pattern matchers implemented: `VPA`, `MERCHANT_EXACT`, `MERCHANT_CONTAINS`, and `REGEX`.
- [x] `MerchantMemoryService` generating sanitized, normalized merchant keys (lowercase, stripped punctuation, normalized spaces).
- [x] Tier 2 lookup returning cached `category_id` with 1.0 confidence and incrementing `hit_count`.
- [x] Selective learning logic: `learn_merchant(draft, category_id)` creates or updates `merchant_memories` only when explicit approval is provided.
- [x] Classification precedence: Rule match (Tier 1) takes priority over Merchant Memory (Tier 2).
- [x] Test suite in `backend/tests/test_rules_and_memory.py` validating priority ordering and auto-learning persistence.

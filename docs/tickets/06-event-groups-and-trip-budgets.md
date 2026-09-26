# 06 — Event Groups & Trip Budgets

**What to build:**  
Contextual event and trip budgeting. Users can create dedicated `groups` with a start date, end date, and budget (e.g. "Goa Trip 2026"). Any transaction occurring within an active group's date window is automatically linked to the group while keeping its independent category intact. Users can manually un-group or reassign individual transactions at any time.

**Blocked by:**  
- 01 — Core Multi-Account Ledger & Invariants

**Status:** ready-for-agent

- [ ] `Group` domain entity with `name`, `start_date`, `end_date`, `budget`, and `is_active`.
- [ ] `GroupAssignor` component that checks `draft.timestamp` against all active groups where `start_date <= timestamp.date() <= end_date`.
- [ ] If matching group exists: assign `group_id = group.id`. If multiple groups overlap, assign the most recently created active group.
- [ ] Manual override support: updating a transaction's `group_id` or setting it to `NULL` leaves the underlying `category_id` and amounts completely untouched.
- [ ] Group aggregation service calculating: `total_spent`, `budget_remaining`, `transaction_count`, and category-wise spending breakdown within the group.
- [ ] Unit tests in `backend/tests/test_groups.py` validating window auto-tagging, manual removal, and isolated cost summaries.

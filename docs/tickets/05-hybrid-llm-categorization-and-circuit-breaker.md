# 05 — Hybrid LLM Categorization & Circuit Breaker

**What to build:**  
The AI categorization tier and review routing. Unmapped transactions are sent to a local `llama.cpp` instance (`Qwen2.5-1.5B`) returning structured category JSON. A stateful circuit breaker protects against timeouts: after 2 consecutive local failures, it automatically bypasses to Google Gemini 2.0 Flash (<400ms). If confidence is below 0.70, the transaction is marked `PENDING_REVIEW` with the guess stored in `suggested_category_id` while leaving `category_id = NULL` to keep main analytics clean.

**Blocked by:**  
- 04 — Deterministic Rules & Merchant Memory

**Status:** ready-for-agent

- [x] Pydantic schema enforcing structured JSON response: `category_id: int`, `confidence: float`, `reasoning: str`.
- [x] Primary client querying local `llama.cpp` endpoint (`http://127.0.0.1:8080/v1/chat/completions`) with a 3.0s timeout.
- [x] Stateful circuit breaker tripping to `OPEN` on 2 consecutive local errors/timeouts, immediately routing subsequent requests to Google Gemini 2.0 Flash (`gemini-2.0-flash`).
- [x] Circuit breaker background probe resetting to `CLOSED` when `http://127.0.0.1:8080/health` returns healthy.
- [x] Confidence threshold routing:
  - If `confidence >= 0.70`: set `category_id = result.category_id`, `status = 'POSTED'`.
  - If `confidence < 0.70`: set `category_id = NULL`, `suggested_category_id = result.category_id`, `status = 'PENDING_REVIEW'`.
- [x] Categorization audit logging: record strategy, confidence, and raw LLM response in `categorization_logs`.
- [x] Mocked test suite in `backend/tests/test_llm_client.py` covering timeout fallback, circuit trip/recovery, and review routing.

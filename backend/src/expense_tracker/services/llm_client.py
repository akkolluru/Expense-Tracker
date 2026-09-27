import json
import os
import re
from typing import Any

import httpx
from pydantic import BaseModel, Field

from expense_tracker.parsers.base import DraftTransaction
from expense_tracker.services.circuit_breaker import CircuitBreaker


class LLMCategorizationResponse(BaseModel):
    category_id: int
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str


class HybridLLMClient:
    def __init__(
        self,
        local_url: str = "http://127.0.0.1:8080/v1/chat/completions",
        health_url: str = "http://127.0.0.1:8080/health",
        gemini_api_key: str | None = None,
        local_timeout: float = 3.0,
        gemini_timeout: float = 5.0,
    ) -> None:
        self.local_url = local_url
        self.health_url = health_url
        self.gemini_api_key = gemini_api_key or os.getenv("GEMINI_API_KEY", "")
        self.local_timeout = local_timeout
        self.gemini_timeout = gemini_timeout
        self.circuit_breaker = CircuitBreaker()

    def _build_prompt(
        self, draft: DraftTransaction, available_categories: list[dict[str, Any]]
    ) -> str:
        cat_json = json.dumps(
            [{"id": c["id"], "name": c["name"]} for c in available_categories], indent=2
        )
        return (
            "You are an expert personal finance categorizer.\n"
            "Your job is to categorize the following transaction into exactly ONE of the available categories.\n\n"
            "TRANSACTION DETAILS:\n"
            f"- Merchant: {draft.merchant_name}\n"
            f"- UPI VPA: {draft.merchant_vpa or 'None'}\n"
            f"- Amount: INR {draft.amount}\n"
            f"- Raw Description: {draft.description or 'None'}\n\n"
            "AVAILABLE CATEGORIES:\n"
            f"{cat_json}\n\n"
            "RULES:\n"
            "1. You MUST pick a category from the AVAILABLE CATEGORIES list by its integer ID.\n"
            "2. If unsure, pick the most plausible category and set confidence lower (< 0.70).\n"
            "3. Do NOT invent new category names or IDs.\n"
            "4. Output STRICT JSON ONLY matching this format:\n"
            '{\n  "category_id": <int>,\n  "confidence": <float between 0.0 and 1.0>,\n  "reasoning": "<short explanation>"\n}'
        )

    @staticmethod
    def _extract_json_str(text: str) -> str:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        return match.group(0) if match else text

    async def categorize(
        self, draft: DraftTransaction, available_categories: list[dict[str, Any]]
    ) -> tuple[LLMCategorizationResponse, str, str]:
        prompt = self._build_prompt(draft, available_categories)

        # 1. Attempt Local llama.cpp if circuit allows
        if self.circuit_breaker.can_attempt_local():
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        self.local_url,
                        json={
                            "messages": [
                                {"role": "system", "content": prompt},
                                {"role": "user", "content": "Categorize this transaction."},
                            ],
                            "temperature": 0.1,
                            "max_tokens": 150,
                        },
                        timeout=self.local_timeout,
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        content = data["choices"][0]["message"]["content"]
                        clean_json = self._extract_json_str(content)
                        parsed = LLMCategorizationResponse.model_validate_json(clean_json)
                        self.circuit_breaker.record_success()
                        return (parsed, "LOCAL_LLM", content)
                    else:
                        self.circuit_breaker.record_failure()
            except Exception:  # noqa: BLE001
                self.circuit_breaker.record_failure()

        # 2. Fallback to Gemini 2.0 Flash
        gemini_url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
            f"?key={self.gemini_api_key}"
        )
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                gemini_url,
                json={
                    "contents": [{"parts": [{"text": prompt + "\nCategorize this transaction."}]}],
                    "generationConfig": {
                        "temperature": 0.1,
                        "responseMimeType": "application/json",
                    },
                },
                timeout=self.gemini_timeout,
            )
            data = resp.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            clean_json = self._extract_json_str(raw_text)
            parsed = LLMCategorizationResponse.model_validate_json(clean_json)
            return (parsed, "GEMINI_LLM", raw_text)

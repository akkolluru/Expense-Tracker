"""
LLM Client — calls the local llama-server (OpenAI-compatible API) for transaction classification.

The llama-server runs Qwen2.5-1.5B-Instruct Q4_K_M at http://127.0.0.1:8080.
"""

import json
import logging
import time
from typing import Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

PROMPT_TEMPLATE = """You are a financial transaction categorizer for an Indian personal expense tracker.

TASK: Classify the following transaction into exactly ONE category and optionally ONE sub-category from the list below.

CATEGORIES:
{category_tree}

TRANSACTION:
- Merchant: {merchant_name}
- Amount: ₹{amount}
- Type: {direction}

RULES:
1. Pick the single best-matching category name from the list.
2. Pick a sub-category ONLY if one clearly applies, otherwise set it to null.
3. Set confidence to "high" if certain, "medium" if likely, "low" if unsure.
4. Respond with ONLY valid JSON. No explanation.

OUTPUT FORMAT:
{{"category": "<name>", "sub_category": "<name_or_null>", "confidence": "high|medium|low"}}"""


class LLMClassificationResult:
    """Result of an LLM classification attempt."""

    def __init__(
        self,
        category: Optional[str] = None,
        sub_category: Optional[str] = None,
        confidence: Optional[str] = None,
        raw_response: Optional[str] = None,
        inference_time_ms: int = 0,
        error: Optional[str] = None,
    ):
        self.category = category
        self.sub_category = sub_category
        self.confidence = confidence
        self.raw_response = raw_response
        self.inference_time_ms = inference_time_ms
        self.error = error

    @property
    def is_success(self) -> bool:
        return self.error is None and self.category is not None

    @property
    def is_high_confidence(self) -> bool:
        return self.confidence in ("high", "medium")


async def classify_transaction(
    merchant_name: str,
    amount: float,
    direction: str,
    category_tree: str,
) -> LLMClassificationResult:
    """
    Call local llama-server for transaction classification.

    Returns an LLMClassificationResult with parsed category info,
    or an error if the call fails or the response can't be parsed.
    """
    prompt = PROMPT_TEMPLATE.format(
        category_tree=category_tree,
        merchant_name=merchant_name,
        amount=amount,
        direction=direction,
    )

    headers = {"Content-Type": "application/json"}
    if settings.llm_api_key:
        headers["Authorization"] = f"Bearer {settings.llm_api_key}"

    payload = {
        "messages": [{"role": "user", "content": prompt}],
        "temperature": settings.llm_temperature,
        "max_tokens": settings.llm_max_tokens,
    }

    start_time = time.monotonic()

    try:
        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            resp = await client.post(
                settings.llm_server_url,
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()

        elapsed_ms = int((time.monotonic() - start_time) * 1000)

        raw_content = resp.json()["choices"][0]["message"]["content"]
        logger.info(f"LLM raw response ({elapsed_ms}ms): {raw_content}")

        # Parse JSON from the response — strip markdown fences if present
        cleaned = raw_content.strip()
        if cleaned.startswith("```"):
            # Remove ```json ... ``` wrapper
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1]) if len(lines) > 2 else cleaned

        parsed = json.loads(cleaned)

        return LLMClassificationResult(
            category=parsed.get("category"),
            sub_category=parsed.get("sub_category"),
            confidence=parsed.get("confidence", "low"),
            raw_response=raw_content,
            inference_time_ms=elapsed_ms,
        )

    except httpx.ConnectError:
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        logger.error("LLM server not reachable (is llama-server running?)")
        return LLMClassificationResult(
            raw_response=None,
            inference_time_ms=elapsed_ms,
            error="llm_server_unreachable",
        )

    except httpx.TimeoutException:
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        logger.error(f"LLM request timed out after {settings.llm_timeout_seconds}s")
        return LLMClassificationResult(
            raw_response=None,
            inference_time_ms=elapsed_ms,
            error="llm_timeout",
        )

    except (json.JSONDecodeError, KeyError, IndexError) as e:
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        raw = raw_content if "raw_content" in dir() else None
        logger.error(f"Failed to parse LLM response: {e}")
        return LLMClassificationResult(
            raw_response=raw,
            inference_time_ms=elapsed_ms,
            error=f"parse_error: {e}",
        )

    except Exception as e:
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        logger.error(f"Unexpected LLM error: {e}")
        return LLMClassificationResult(
            raw_response=None,
            inference_time_ms=elapsed_ms,
            error=f"unexpected: {e}",
        )

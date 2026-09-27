import json
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from sqlalchemy import select

from expense_tracker.models.account import Account
from expense_tracker.models.category import Category
from expense_tracker.models.raw_message import RawMessage
from expense_tracker.models.rule import CategorizationLog
from expense_tracker.parsers.base import DraftTransaction
from expense_tracker.services.categorization import CategorizationService
from expense_tracker.services.circuit_breaker import CircuitBreaker, CircuitState
from expense_tracker.services.llm_client import HybridLLMClient, LLMCategorizationResponse


def test_llm_structured_response_parsing():
    raw_json = '{"category_id": 4, "confidence": 0.85, "reasoning": "Swiggy is food delivery."}'
    parsed = LLMCategorizationResponse.model_validate_json(raw_json)
    assert parsed.category_id == 4
    assert parsed.confidence == 0.85
    assert "food delivery" in parsed.reasoning


@pytest.mark.asyncio
async def test_circuit_breaker_tripping_and_recovery():
    cb = CircuitBreaker(failure_threshold=2)
    assert cb.state == CircuitState.CLOSED

    # Record 1 failure
    cb.record_failure()
    assert cb.state == CircuitState.CLOSED
    assert cb.failure_count == 1

    # Record 2nd failure -> Tripped to OPEN
    cb.record_failure()
    assert cb.state == CircuitState.OPEN

    # Probe health check
    mock_client = AsyncMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_client.get.return_value = mock_resp

    recovered = await cb.probe_health(mock_client, "http://127.0.0.1:8080/health")
    assert recovered is True
    assert cb.state == CircuitState.CLOSED
    assert cb.failure_count == 0


@pytest.mark.asyncio
async def test_hybrid_llm_local_success():
    client = HybridLLMClient()
    draft = DraftTransaction(
        raw_message_id=1,
        account_institution="HDFC",
        amount=Decimal("350.00"),
        merchant_name="Zomato",
        raw_timestamp=datetime.now(UTC),
    )
    categories = [{"id": 2, "name": "Dining Out"}]

    local_resp_data = {
        "choices": [
            {
                "message": {
                    "content": '{"category_id": 2, "confidence": 0.95, "reasoning": "Zomato is dining out."}'
                }
            }
        ]
    }

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = local_resp_data
        mock_resp.text = json.dumps(local_resp_data)
        mock_post.return_value = mock_resp

        resp, strategy, _raw_text = await client.categorize(draft, categories)
        assert resp.category_id == 2
        assert resp.confidence == 0.95
        assert strategy == "LOCAL_LLM"


@pytest.mark.asyncio
async def test_hybrid_llm_fallback_to_gemini_on_timeout():
    client = HybridLLMClient()
    draft = DraftTransaction(
        raw_message_id=1,
        account_institution="HDFC",
        amount=Decimal("1200.00"),
        merchant_name="Unknown Cloud",
        raw_timestamp=datetime.now(UTC),
    )
    categories = [{"id": 5, "name": "Cloud Hosting"}]

    gemini_resp_data = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": '{"category_id": 5, "confidence": 0.88, "reasoning": "Cloud hosting service."}'
                        }
                    ]
                }
            }
        ]
    }

    async def side_effect(url, **kwargs):
        if "8080" in url:
            raise httpx.TimeoutException("Local server timed out")
        # Gemini call
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = gemini_resp_data
        mock_resp.text = json.dumps(gemini_resp_data)
        return mock_resp

    with patch.object(httpx.AsyncClient, "post", side_effect=side_effect):
        resp, strategy, _raw_text = await client.categorize(draft, categories)
        assert resp.category_id == 5
        assert resp.confidence == 0.88
        assert strategy == "GEMINI_LLM"
        assert client.circuit_breaker.failure_count == 1


@pytest.mark.asyncio
async def test_confidence_threshold_routing_and_audit_log(async_session):
    account = Account(
        name="HDFC",
        institution="HDFC",
        account_type="SAVINGS",
        balance=Decimal("10000.00"),
        is_active=True,
    )
    cat_food = Category(name="Food", color="#F00")
    cat_misc = Category(name="Misc", color="#888")
    async_session.add_all([account, cat_food, cat_misc])
    await async_session.commit()
    await async_session.refresh(account)
    await async_session.refresh(cat_food)
    await async_session.refresh(cat_misc)

    # Create raw messages for foreign key validity
    raw1 = RawMessage(
        source="GMAIL",
        external_id="e1",
        payload_hash="h1",
        raw_body="b1",
        received_at=datetime.now(UTC),
    )
    raw2 = RawMessage(
        source="GMAIL",
        external_id="e2",
        payload_hash="h2",
        raw_body="b2",
        received_at=datetime.now(UTC),
    )
    async_session.add_all([raw1, raw2])
    await async_session.commit()
    await async_session.refresh(raw1)
    await async_session.refresh(raw2)

    # 1. High confidence (0.90 >= 0.70) => POSTED, category_id set, suggested_category_id = NULL
    draft_high = DraftTransaction(
        raw_message_id=raw1.id,
        account_institution="HDFC",
        amount=Decimal("300.00"),
        merchant_name="Known Cafe",
        raw_timestamp=datetime.now(UTC),
    )
    high_llm_resp = LLMCategorizationResponse(
        category_id=cat_food.id, confidence=0.90, reasoning="Known cafe"
    )

    with patch.object(HybridLLMClient, "categorize", new_callable=AsyncMock) as mock_cat:
        mock_cat.return_value = (high_llm_resp, "LOCAL_LLM", '{"test": 1}')
        tx_high = await CategorizationService.process_and_record(
            async_session, draft_high, account.id
        )
        assert tx_high.status == "POSTED"
        assert tx_high.category_id == cat_food.id
        assert tx_high.suggested_category_id is None
        assert tx_high.categorization_strategy == "LOCAL_LLM"
        assert tx_high.categorization_confidence == 0.90

    # 2. Low confidence (0.55 < 0.70) => PENDING_REVIEW, category_id = NULL, suggested_category_id = cat_misc.id
    draft_low = DraftTransaction(
        raw_message_id=raw2.id,
        account_institution="HDFC",
        amount=Decimal("750.00"),
        merchant_name="Ambiguous Vendor",
        raw_timestamp=datetime.now(UTC),
    )
    low_llm_resp = LLMCategorizationResponse(
        category_id=cat_misc.id, confidence=0.55, reasoning="Vague vendor string"
    )

    with patch.object(HybridLLMClient, "categorize", new_callable=AsyncMock) as mock_cat:
        mock_cat.return_value = (low_llm_resp, "GEMINI_LLM", '{"test": 2}')
        tx_low = await CategorizationService.process_and_record(
            async_session, draft_low, account.id
        )
        assert tx_low.status == "PENDING_REVIEW"
        assert tx_low.category_id is None
        assert tx_low.suggested_category_id == cat_misc.id
        assert tx_low.categorization_strategy == "GEMINI_LLM"
        assert tx_low.categorization_confidence == 0.55

    # Check CategorizationLogs
    stmt = select(CategorizationLog).where(CategorizationLog.transaction_id == tx_low.id)
    res = await async_session.execute(stmt)
    log = res.scalar_one_or_none()
    assert log is not None
    assert log.strategy_used == "GEMINI_LLM"
    assert log.confidence == 0.55
    assert log.reasoning == "Vague vendor string"

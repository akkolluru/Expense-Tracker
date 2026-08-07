"""
Tests for the categorization pipeline.

We test the three layers independently:
1. Rule Engine: VPA match → auto-categorize
2. LLM: mock the llm_client → verify routing
3. Fallthrough: no rule, LLM fails → pending_review
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

from app.services.categorizer import (
    check_rule,
    categorize_transaction,
    build_category_tree_string,
    resolve_category_id,
)
from app.services.llm_client import LLMClassificationResult


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_mock_txn(
    txn_id="test-txn-1",
    vpa="merchant@upi",
    merchant_name="Test Merchant",
    amount=100.0,
    direction="debit",
    status="pending_review",
    category_id=None,
    sub_category_id=None,
    categorized_by=None,
    source="email_auto",
):
    """Create a mock Transaction object."""
    txn = MagicMock()
    txn.id = txn_id
    txn.vpa = vpa
    txn.merchant_name = merchant_name
    txn.amount = amount
    txn.direction = direction
    txn.status = status
    txn.category_id = category_id
    txn.sub_category_id = sub_category_id
    txn.categorized_by = categorized_by
    txn.source = source
    txn.is_misclassified = False
    return txn


def make_mock_rule(category_id=5, sub_category_id=12, hit_count=3):
    """Create a mock Rule object."""
    rule = MagicMock()
    rule.category_id = category_id
    rule.sub_category_id = sub_category_id
    rule.hit_count = hit_count
    return rule


# ── Layer 1: Rule Engine ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_check_rule_found():
    """When a rule exists for the VPA, check_rule should return it."""
    mock_rule = make_mock_rule()
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_rule
    mock_db.execute.return_value = mock_result

    result = await check_rule("merchant@upi", mock_db)
    assert result is mock_rule


@pytest.mark.asyncio
async def test_check_rule_not_found():
    """When no rule exists for the VPA, check_rule returns None."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    result = await check_rule("unknown@upi", mock_db)
    assert result is None


# ── Layer 1 Integration: categorize_transaction with rule match ──────────────

@pytest.mark.asyncio
@patch("app.services.categorizer.check_rule")
async def test_categorize_transaction_rule_match(mock_check_rule):
    """If rule engine finds a match, transaction should be categorized immediately."""
    mock_rule = make_mock_rule(category_id=5, sub_category_id=12)
    mock_check_rule.return_value = mock_rule

    mock_db = AsyncMock()
    txn = make_mock_txn(vpa="zomato@upi")

    status = await categorize_transaction(txn, mock_db)

    assert status == "categorized"
    assert txn.category_id == 5
    assert txn.sub_category_id == 12
    assert txn.categorized_by == "rule_engine"
    assert txn.status == "categorized"
    # Rule hit_count should be incremented
    assert mock_rule.hit_count == 4
    # A CategorizationLog should have been added
    mock_db.add.assert_called()


# ── Layer 2: LLM high-confidence categorization ─────────────────────────────

@pytest.mark.asyncio
@patch("app.services.categorizer.resolve_category_id")
@patch("app.services.categorizer.classify_transaction")
@patch("app.services.categorizer.build_category_tree_string")
@patch("app.services.categorizer.check_rule")
async def test_categorize_transaction_llm_high_confidence(
    mock_check_rule,
    mock_build_tree,
    mock_classify,
    mock_resolve,
):
    """LLM returns high confidence → transaction should be categorized."""
    mock_check_rule.return_value = None
    mock_build_tree.return_value = "- Food\n- Travel"
    mock_classify.return_value = LLMClassificationResult(
        category="Food",
        sub_category=None,
        confidence="high",
        raw_response='{"category": "Food", "sub_category": null, "confidence": "high"}',
        inference_time_ms=250,
    )
    # First call resolves "Food" parent → id 3
    # Second call for sub_category won't happen since sub_category is None
    mock_resolve.return_value = 3

    mock_db = AsyncMock()
    txn = make_mock_txn(vpa="unknown@upi")

    status = await categorize_transaction(txn, mock_db)

    assert status == "categorized"
    assert txn.category_id == 3
    assert txn.categorized_by == "llm"
    mock_db.add.assert_called()


# ── Layer 2: LLM low-confidence → pending_review ────────────────────────────

@pytest.mark.asyncio
@patch("app.services.categorizer.classify_transaction")
@patch("app.services.categorizer.build_category_tree_string")
@patch("app.services.categorizer.check_rule")
async def test_categorize_transaction_llm_low_confidence(
    mock_check_rule,
    mock_build_tree,
    mock_classify,
):
    """LLM returns low confidence → transaction stays pending_review."""
    mock_check_rule.return_value = None
    mock_build_tree.return_value = "- Food\n- Travel"
    mock_classify.return_value = LLMClassificationResult(
        category="Food",
        sub_category=None,
        confidence="low",
        raw_response='{"category": "Food", "sub_category": null, "confidence": "low"}',
        inference_time_ms=300,
    )

    mock_db = AsyncMock()
    txn = make_mock_txn(vpa="ambiguous@upi")

    status = await categorize_transaction(txn, mock_db)

    assert status == "pending_review"
    assert txn.status == "pending_review"


# ── Layer 2: LLM error → pending_review ──────────────────────────────────────

@pytest.mark.asyncio
@patch("app.services.categorizer.classify_transaction")
@patch("app.services.categorizer.build_category_tree_string")
@patch("app.services.categorizer.check_rule")
async def test_categorize_transaction_llm_error(
    mock_check_rule,
    mock_build_tree,
    mock_classify,
):
    """LLM server unreachable → transaction stays pending_review."""
    mock_check_rule.return_value = None
    mock_build_tree.return_value = "- Food"
    mock_classify.return_value = LLMClassificationResult(
        error="llm_server_unreachable",
        inference_time_ms=50,
    )

    mock_db = AsyncMock()
    txn = make_mock_txn(vpa="test@upi")

    status = await categorize_transaction(txn, mock_db)

    assert status == "pending_review"
    assert txn.status == "pending_review"


# ── Layer 2: LLM returns unknown category → pending_review ───────────────────

@pytest.mark.asyncio
@patch("app.services.categorizer.resolve_category_id")
@patch("app.services.categorizer.classify_transaction")
@patch("app.services.categorizer.build_category_tree_string")
@patch("app.services.categorizer.check_rule")
async def test_categorize_transaction_llm_unknown_category(
    mock_check_rule,
    mock_build_tree,
    mock_classify,
    mock_resolve,
):
    """LLM returns a category name not in DB → pending_review."""
    mock_check_rule.return_value = None
    mock_build_tree.return_value = "- Food"
    mock_classify.return_value = LLMClassificationResult(
        category="Nonexistent Category",
        confidence="high",
        raw_response='{"category": "Nonexistent Category", "confidence": "high"}',
        inference_time_ms=200,
    )
    mock_resolve.return_value = None  # Category not found in DB

    mock_db = AsyncMock()
    txn = make_mock_txn(vpa="test@upi")

    status = await categorize_transaction(txn, mock_db)

    assert status == "pending_review"


# ── No VPA: skip rule engine, go straight to LLM ────────────────────────────

@pytest.mark.asyncio
@patch("app.services.categorizer.classify_transaction")
@patch("app.services.categorizer.build_category_tree_string")
async def test_categorize_transaction_no_vpa_skips_rule_engine(
    mock_build_tree,
    mock_classify,
):
    """Manual transaction with no VPA should skip rule engine and go to LLM."""
    mock_build_tree.return_value = "- Food"
    mock_classify.return_value = LLMClassificationResult(
        error="llm_server_unreachable",
        inference_time_ms=50,
    )

    mock_db = AsyncMock()
    txn = make_mock_txn(vpa=None)

    status = await categorize_transaction(txn, mock_db)

    assert status == "pending_review"

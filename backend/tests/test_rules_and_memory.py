from decimal import Decimal

import pytest
from sqlalchemy import select

from expense_tracker.models.account import Account
from expense_tracker.models.category import Category
from expense_tracker.models.rule import CategorizationLog, Rule
from expense_tracker.parsers.base import DraftTransaction
from expense_tracker.services.categorization import CategorizationService
from expense_tracker.services.merchant_memory import MerchantMemoryService
from expense_tracker.services.rules import RuleEngine


@pytest.mark.asyncio
async def test_rule_engine_pattern_types(async_session):
    cat_food = Category(name="Food", color="#F00")
    cat_travel = Category(name="Travel", color="#0F0")
    cat_utilities = Category(name="Utilities", color="#00F")
    cat_shopping = Category(name="Shopping", color="#FF0")
    async_session.add_all([cat_food, cat_travel, cat_utilities, cat_shopping])
    await async_session.commit()

    # Create 4 rules
    r_vpa = Rule(
        name="Swiggy VPA",
        pattern_type="VPA",
        pattern_value="swiggy@icici",
        category_id=cat_food.id,
        priority=100,
    )
    r_exact = Rule(
        name="Uber Exact",
        pattern_type="MERCHANT_EXACT",
        pattern_value="Uber India",
        category_id=cat_travel.id,
        priority=100,
    )
    r_contains = Rule(
        name="Amazon Substring",
        pattern_type="MERCHANT_CONTAINS",
        pattern_value="amazon",
        category_id=cat_shopping.id,
        priority=100,
    )
    r_regex = Rule(
        name="Electricity Regex",
        pattern_type="REGEX",
        pattern_value=r"(?i)bescom|electricity|tata power",
        category_id=cat_utilities.id,
        priority=100,
    )
    async_session.add_all([r_vpa, r_exact, r_contains, r_regex])
    await async_session.commit()

    # 1. Match VPA
    d1 = DraftTransaction(
        raw_message_id=1,
        account_institution="HDFC",
        amount=Decimal("250.00"),
        merchant_name="Swiggy Order",
        merchant_vpa="swiggy@icici",
    )
    m1 = await RuleEngine.evaluate(async_session, d1)
    assert m1 is not None
    assert m1.category_id == cat_food.id

    # 2. Match Exact
    d2 = DraftTransaction(
        raw_message_id=2,
        account_institution="HDFC",
        amount=Decimal("300.00"),
        merchant_name="Uber India",
    )
    m2 = await RuleEngine.evaluate(async_session, d2)
    assert m2 is not None
    assert m2.category_id == cat_travel.id

    # 3. Match Contains
    d3 = DraftTransaction(
        raw_message_id=3,
        account_institution="HDFC",
        amount=Decimal("1200.00"),
        merchant_name="AMAZON PAY INDIA PVT LTD",
    )
    m3 = await RuleEngine.evaluate(async_session, d3)
    assert m3 is not None
    assert m3.category_id == cat_shopping.id

    # 4. Match Regex
    d4 = DraftTransaction(
        raw_message_id=4,
        account_institution="HDFC",
        amount=Decimal("850.00"),
        merchant_name="BESCOM Online Bill Payment",
    )
    m4 = await RuleEngine.evaluate(async_session, d4)
    assert m4 is not None
    assert m4.category_id == cat_utilities.id


@pytest.mark.asyncio
async def test_rule_priority_and_amount_constraints(async_session):
    cat_daily = Category(name="Daily Food", color="#F00")
    cat_team = Category(name="Team Outing", color="#0F0")
    async_session.add_all([cat_daily, cat_team])
    await async_session.commit()

    # Rule A: Swiggy > 2000 => Team Outing (Priority 10)
    r_team = Rule(
        name="Swiggy Big Team",
        pattern_type="VPA",
        pattern_value="swiggy@icici",
        min_amount=Decimal("2000.01"),
        priority=10,
        category_id=cat_team.id,
    )
    # Rule B: Swiggy any amount => Daily Food (Priority 50)
    r_daily = Rule(
        name="Swiggy Daily",
        pattern_type="VPA",
        pattern_value="swiggy@icici",
        priority=50,
        category_id=cat_daily.id,
    )
    async_session.add_all([r_team, r_daily])
    await async_session.commit()

    # Amount 350 <= 2000 => falls to r_daily (priority 50)
    d_small = DraftTransaction(
        raw_message_id=1,
        account_institution="HDFC",
        amount=Decimal("350.00"),
        merchant_name="Swiggy",
        merchant_vpa="swiggy@icici",
    )
    m_small = await RuleEngine.evaluate(async_session, d_small)
    assert m_small is not None
    assert m_small.category_id == cat_daily.id

    # Amount 4500 > 2000 => matches r_team (priority 10)
    d_big = DraftTransaction(
        raw_message_id=2,
        account_institution="HDFC",
        amount=Decimal("4500.00"),
        merchant_name="Swiggy",
        merchant_vpa="swiggy@icici",
    )
    m_big = await RuleEngine.evaluate(async_session, d_big)
    assert m_big is not None
    assert m_big.category_id == cat_team.id


def test_merchant_memory_key_normalization():
    # VPA normalization
    vpa_key = MerchantMemoryService.normalize_key("Swiggy App", "Swiggy@ICICI")
    assert vpa_key == "swiggy@icici"

    # Card terminal messy string normalization
    card_key = MerchantMemoryService.normalize_key("STARBUCKS COFFEE #0492 BLR IN 560001", None)
    assert card_key == "starbucks coffee"


@pytest.mark.asyncio
async def test_merchant_memory_lookup_and_learning(async_session):
    cat_coffee = Category(name="Coffee", color="#78350F")
    async_session.add(cat_coffee)
    await async_session.commit()

    # Learn merchant
    memory = await MerchantMemoryService.learn_merchant(
        async_session,
        category_id=cat_coffee.id,
        merchant_name="Blue Tokai Coffee Roasters",
        merchant_vpa="bluetokai@icici",
    )
    assert memory.merchant_key == "bluetokai@icici"
    assert memory.hit_count == 1
    assert memory.confidence == 1.0

    # Lookup
    found = await MerchantMemoryService.lookup(
        async_session, merchant_name="Blue Tokai Coffee Roasters", merchant_vpa="bluetokai@icici"
    )
    assert found is not None
    assert found.category_id == cat_coffee.id
    assert found.hit_count == 2  # Hit count incremented


@pytest.mark.asyncio
async def test_categorization_cascade_precedence(async_session):
    cat_rule = Category(name="Rule Override", color="#111")
    cat_mem = Category(name="Memory Default", color="#222")
    async_session.add_all([cat_rule, cat_mem])
    await async_session.commit()

    # 1. Tier 2 memory learned: starbucks -> Memory Default
    await MerchantMemoryService.learn_merchant(
        async_session, category_id=cat_mem.id, merchant_name="Starbucks", merchant_vpa=None
    )

    # 2. Tier 1 rule configured: STARBUCKS -> Rule Override
    rule = Rule(
        name="Starbucks Rule",
        pattern_type="MERCHANT_CONTAINS",
        pattern_value="starbucks",
        priority=10,
        category_id=cat_rule.id,
    )
    async_session.add(rule)
    await async_session.commit()

    # Draft matching both
    draft = DraftTransaction(
        raw_message_id=1,
        account_institution="HDFC",
        amount=Decimal("450.00"),
        merchant_name="Starbucks Coffee BLR",
    )

    # Classification cascade
    result = await CategorizationService.classify(async_session, draft)
    assert result is not None
    assert result.strategy == "RULE"  # Rule takes precedence!
    assert result.category_id == cat_rule.id
    assert result.confidence == 1.0


@pytest.mark.asyncio
async def test_merchant_memory_never_auto_classify_lifecycle(async_session):
    cat_friends = Category(name="Friends & Family", color="#123")
    async_session.add(cat_friends)
    await async_session.commit()

    # 1. Learn with never_auto_classify=True
    memory = await MerchantMemoryService.learn_merchant(
        async_session,
        category_id=cat_friends.id,
        merchant_name="Rahul Sharma",
        merchant_vpa="rahul@upi",
        never_auto_classify=True,
    )
    assert memory.never_auto_classify is True
    assert memory.merchant_key == "rahul@upi"

    # 2. Lookup preserves never_auto_classify=True
    found = await MerchantMemoryService.lookup(
        async_session,
        merchant_name="Rahul Sharma",
        merchant_vpa="rahul@upi",
    )
    assert found is not None
    assert found.never_auto_classify is True

    # 3. Subsequent classify returns NEVER_AUTO_CLASSIFY strategy and 0.0 confidence
    draft = DraftTransaction(
        raw_message_id=None,
        account_institution="HDFC",
        amount=Decimal("500.00"),
        merchant_name="Rahul Sharma",
        merchant_vpa="rahul@upi",
    )
    result = await CategorizationService.classify(async_session, draft)
    assert result is not None
    assert result.strategy == "NEVER_AUTO_CLASSIFY"
    assert result.category_id is None
    assert result.confidence == 0.0

    # 4. Update memory with never_auto_classify=False
    updated = await MerchantMemoryService.learn_merchant(
        async_session,
        category_id=cat_friends.id,
        merchant_name="Rahul Sharma",
        merchant_vpa="rahul@upi",
        never_auto_classify=False,
    )
    assert updated.never_auto_classify is False

    # 5. set_never_classify helper method can toggle it back
    toggled = await MerchantMemoryService.set_never_classify(
        async_session,
        merchant_name="Rahul Sharma",
        merchant_vpa="rahul@upi",
        never_auto_classify=True,
    )
    assert toggled is not None
    assert toggled.never_auto_classify is True


@pytest.mark.asyncio
async def test_categorization_service_never_auto_classify_bypasses_llm(async_session, monkeypatch):
    cat_friends = Category(name="Friends", color="#456")
    account = Account(name="HDFC Test", institution="HDFC", balance=Decimal("10000.00"), is_active=True)
    async_session.add_all([cat_friends, account])
    await async_session.commit()
    await async_session.refresh(account)

    # Set merchant memory to never_auto_classify
    await MerchantMemoryService.learn_merchant(
        async_session,
        category_id=cat_friends.id,
        merchant_name="Rahul Dinner Cab",
        merchant_vpa="rahul@upi",
        never_auto_classify=True,
    )

    # If LLM is invoked, fail the test
    async def fail_if_llm_called(*args, **kwargs):
        raise AssertionError("Tier 3 LLM client should NOT be called when never_auto_classify is set!")

    monkeypatch.setattr(CategorizationService.llm_client, "categorize", fail_if_llm_called)

    draft = DraftTransaction(
        raw_message_id=None,
        account_institution="HDFC",
        amount=Decimal("1200.00"),
        merchant_name="Rahul Dinner Cab",
        merchant_vpa="rahul@upi",
    )

    tx = await CategorizationService.process_and_record(
        session=async_session,
        draft=draft,
        account_id=account.id,
    )

    # Transaction must be routed to PENDING_REVIEW without category
    assert tx.status == "PENDING_REVIEW"
    assert tx.category_id is None
    assert tx.suggested_category_id is None
    assert tx.categorization_strategy == "NEVER_AUTO_CLASSIFY"
    assert tx.categorization_confidence == 0.0

    # Verify CategorizationLog
    stmt = select(CategorizationLog).where(CategorizationLog.transaction_id == tx.id)
    log_res = await async_session.execute(stmt)
    log = log_res.scalar_one_or_none()
    assert log is not None
    assert log.strategy_used == "NEVER_AUTO_CLASSIFY"
    assert log.confidence == 0.0
    assert log.reasoning == "Merchant marked as Never Auto-Classify (Always Ask)"


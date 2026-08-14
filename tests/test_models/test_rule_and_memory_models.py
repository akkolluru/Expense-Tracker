"""Tests for Rule and MerchantMemory models."""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountType
from app.models.category import Category
from app.models.merchant_memory import MerchantKeyType, MerchantMemory
from app.models.rule import Rule, RuleType


@pytest.mark.asyncio
async def test_create_category_rule(db_session: AsyncSession):
    """Test creating a deterministic category matching rule."""
    cat = Category(name="Transportation")
    db_session.add(cat)
    await db_session.commit()

    rule = Rule(
        rule_type=RuleType.VPA.value,
        pattern="uber.india@icici",
        target_category_id=cat.id,
        priority=10,
    )
    db_session.add(rule)
    await db_session.commit()
    await db_session.refresh(rule)

    assert rule.id is not None
    assert rule.rule_type == "VPA"
    assert rule.pattern == "uber.india@icici"
    assert rule.target_category_id == cat.id
    assert rule.priority == 10
    assert rule.is_transfer is False
    assert rule.is_active is True
    assert rule.hit_count == 0


@pytest.mark.asyncio
async def test_create_transfer_rule(db_session: AsyncSession):
    """Test creating a transfer rule targeting a destination account."""
    dest_acc = Account(
        name="ICICI Credit Card",
        institution="ICICI",
        account_type=AccountType.CREDIT_CARD.value,
    )
    db_session.add(dest_acc)
    await db_session.commit()

    rule = Rule(
        rule_type=RuleType.KEYWORD.value,
        pattern="CREDIT CARD PAYMENT",
        is_transfer=True,
        transfer_dest_account_id=dest_acc.id,
        priority=5,
    )
    db_session.add(rule)
    await db_session.commit()
    await db_session.refresh(rule)

    assert rule.is_transfer is True
    assert rule.transfer_dest_account_id == dest_acc.id
    assert rule.target_category_id is None


@pytest.mark.asyncio
async def test_merchant_memory_unique_key(db_session: AsyncSession):
    """Test MerchantMemory creation and uniqueness of merchant_key."""
    cat = Category(name="Food")
    db_session.add(cat)
    await db_session.commit()

    mem1 = MerchantMemory(
        merchant_key="swiggy@icici",
        key_type=MerchantKeyType.VPA.value,
        category_id=cat.id,
    )
    db_session.add(mem1)
    await db_session.commit()
    await db_session.refresh(mem1)

    assert mem1.id is not None
    assert mem1.merchant_key == "swiggy@icici"
    assert mem1.key_type == "VPA"
    assert mem1.category_id == cat.id
    assert mem1.hit_count == 1
    assert mem1.last_used_at is not None

    # Attempt duplicate merchant_key
    mem2 = MerchantMemory(
        merchant_key="swiggy@icici",
        key_type=MerchantKeyType.VPA.value,
        category_id=cat.id,
    )
    db_session.add(mem2)
    with pytest.raises(IntegrityError):
        await db_session.commit()

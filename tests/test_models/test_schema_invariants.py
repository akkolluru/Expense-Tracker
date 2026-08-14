"""Tests for overall schema metadata, foreign key invariants, and multi-table lifecycles."""

import hashlib
from datetime import UTC, date, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import Base
from app.models.account import Account, AccountType
from app.models.categorization_log import CategorizationLog
from app.models.category import Category
from app.models.group import Group
from app.models.raw_message import RawMessage, RawMessageSource, RawMessageStatus
from app.models.split import Split
from app.models.transaction import (
    CategorizationStrategy,
    Transaction,
    TransactionStatus,
    TransactionType,
)


def test_schema_metadata_contains_all_core_v2_tables():
    """Verify that Base.metadata has registered all core domain tables."""
    table_names = set(Base.metadata.tables.keys())
    expected_tables = {
        "accounts",
        "raw_messages",
        "categories",
        "groups",
        "transactions",
        "splits",
        "rules",
        "merchant_memory",
        "categorization_logs",
    }
    assert expected_tables.issubset(table_names), (
        f"Missing tables: {expected_tables - table_names}"
    )


@pytest.mark.asyncio
async def test_foreign_key_enforcement_invalid_account(db_session: AsyncSession):
    """Verify foreign key enforcement when referencing nonexistent account."""
    txn = Transaction(
        source_account_id="nonexistent-account-id",
        transaction_type=TransactionType.EXPENSE.value,
        amount=100.0,
        timestamp=datetime.now(UTC),
    )
    db_session.add(txn)
    with pytest.raises(IntegrityError):
        await db_session.commit()


@pytest.mark.asyncio
async def test_foreign_key_enforcement_invalid_category(db_session: AsyncSession):
    """Verify foreign key enforcement when referencing nonexistent category."""
    acc = Account(
        name="Main", institution="HDFC", account_type=AccountType.SAVINGS.value
    )
    db_session.add(acc)
    await db_session.commit()

    txn = Transaction(
        source_account_id=acc.id,
        transaction_type=TransactionType.EXPENSE.value,
        amount=100.0,
        timestamp=datetime.now(UTC),
        category_id=999999,  # Nonexistent category
    )
    db_session.add(txn)
    with pytest.raises(IntegrityError):
        await db_session.commit()


@pytest.mark.asyncio
async def test_full_lifecycle_and_relationship_traversal(db_session: AsyncSession):
    """Test full multi-entity persistence and relationship traversal."""
    # 1. Setup Accounts
    salary_acc = Account(
        name="HDFC Salary",
        institution="HDFC",
        account_type=AccountType.SAVINGS.value,
        account_identifier="1234",
    )
    db_session.add(salary_acc)

    # 2. Setup Category Hierarchy
    food_cat = Category(name="Food", icon="🍔")
    db_session.add(food_cat)
    await db_session.commit()
    await db_session.refresh(food_cat)

    dining_cat = Category(name="Dining Out", parent_id=food_cat.id, icon="🍽️")
    groceries_cat = Category(name="Groceries", parent_id=food_cat.id, icon="🛒")
    db_session.add_all([dining_cat, groceries_cat])

    # 3. Setup Trip Group
    trip = Group(
        name="Goa Trip 2026",
        start_date=date(2026, 8, 10),
        end_date=date(2026, 8, 15),
        budget=20000.0,
    )
    db_session.add(trip)

    # 4. Ingest Raw Message
    raw_text = "Paid Rs 3000.00 to Supermarket on 11-Aug-2026 from A/C XX1234"
    raw_hash = hashlib.sha256(raw_text.encode()).hexdigest()
    raw_msg = RawMessage(
        source=RawMessageSource.GMAIL.value,
        external_message_id="gmail_msg_001",
        payload_hash=raw_hash,
        raw_payload=raw_text,
        status=RawMessageStatus.PARSED.value,
        received_at=datetime.now(UTC),
    )
    db_session.add(raw_msg)
    await db_session.commit()

    # 5. Create Split Transaction linked to RawMessage, Account, and Group
    txn = Transaction(
        source_account_id=salary_acc.id,
        raw_message_id=raw_msg.id,
        group_id=trip.id,
        transaction_type=TransactionType.EXPENSE.value,
        amount=3000.0,
        currency="INR",
        timestamp=datetime.now(UTC),
        vpa="supermarket@upi",
        merchant_name="Supermarket",
        is_split=True,
        category_id=None,
        status=TransactionStatus.COMMITTED.value,
        categorized_by=CategorizationStrategy.MANUAL.value,
        txn_ref="UTR-20260811-001",
    )
    db_session.add(txn)
    await db_session.commit()

    # 6. Add line items to Splits
    s1 = Split(
        transaction_id=txn.id,
        category_id=food_cat.id,
        sub_category_id=dining_cat.id,
        amount=2000.0,
        note="Dinner",
    )
    s2 = Split(
        transaction_id=txn.id,
        category_id=food_cat.id,
        sub_category_id=groceries_cat.id,
        amount=1000.0,
        note="Snacks",
    )
    log = CategorizationLog(
        transaction_id=txn.id,
        action="MANUAL_SPLIT",
        strategy=CategorizationStrategy.MANUAL.value,
    )
    db_session.add_all([s1, s2, log])
    await db_session.commit()

    # 7. Query and Verify full graph traversal
    stmt = (
        select(Transaction)
        .where(Transaction.id == txn.id)
        .options(
            selectinload(Transaction.source_account),
            selectinload(Transaction.raw_message),
            selectinload(Transaction.group),
            selectinload(Transaction.splits).selectinload(Split.sub_category),
            selectinload(Transaction.categorization_logs),
        )
    )
    res = await db_session.execute(stmt)
    loaded_txn = res.scalar_one()

    assert loaded_txn.source_account is not None
    assert loaded_txn.source_account.name == "HDFC Salary"
    assert loaded_txn.raw_message is not None
    assert loaded_txn.raw_message.external_message_id == "gmail_msg_001"
    assert loaded_txn.group is not None
    assert loaded_txn.group.name == "Goa Trip 2026"
    assert len(loaded_txn.splits) == 2
    assert {
        s.sub_category.name for s in loaded_txn.splits if s.sub_category is not None
    } == {"Dining Out", "Groceries"}
    assert len(loaded_txn.categorization_logs) == 1

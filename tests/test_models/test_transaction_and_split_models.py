"""Tests for Transaction, Split, and CategorizationLog models."""

from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.account import Account, AccountType
from app.models.categorization_log import CategorizationLog
from app.models.category import Category
from app.models.group import Group
from app.models.split import Split
from app.models.transaction import (
    CategorizationStrategy,
    Transaction,
    TransactionStatus,
    TransactionType,
)


@pytest.mark.asyncio
async def test_create_expense_transaction(db_session: AsyncSession):
    """Test standard single-category expense transaction."""
    account = Account(
        name="HDFC Salary",
        institution="HDFC",
        account_type=AccountType.SAVINGS.value,
    )
    cat = Category(name="Food")
    group = Group(name="Goa Trip 2026")
    db_session.add_all([account, cat, group])
    await db_session.commit()

    txn = Transaction(
        source_account_id=account.id,
        transaction_type=TransactionType.EXPENSE.value,
        amount=1450.50,
        currency="INR",
        timestamp=datetime.now(UTC),
        vpa="swiggy@icici",
        merchant_name="Swiggy",
        category_id=cat.id,
        group_id=group.id,
        status=TransactionStatus.COMMITTED.value,
        categorized_by=CategorizationStrategy.RULE.value,
        txn_ref="UPI-1234567890",
    )
    db_session.add(txn)
    await db_session.commit()
    await db_session.refresh(txn)

    assert txn.id is not None
    assert len(txn.id) == 36
    assert txn.source_account_id == account.id
    assert txn.destination_account_id is None
    assert txn.transaction_type == "EXPENSE"
    assert txn.amount == 1450.50
    assert txn.category_id == cat.id
    assert txn.group_id == group.id
    assert txn.is_split is False
    assert txn.is_group_locked is False
    assert txn.status == "COMMITTED"
    assert txn.categorized_by == "RULE"
    assert txn.txn_ref == "UPI-1234567890"


@pytest.mark.asyncio
async def test_create_transfer_transaction(db_session: AsyncSession):
    """Test transfer transaction linking source and destination accounts."""
    src = Account(
        name="HDFC Savings", institution="HDFC", account_type=AccountType.SAVINGS.value
    )
    dst = Account(
        name="ICICI Card",
        institution="ICICI",
        account_type=AccountType.CREDIT_CARD.value,
    )
    db_session.add_all([src, dst])
    await db_session.commit()

    transfer = Transaction(
        source_account_id=src.id,
        destination_account_id=dst.id,
        transaction_type=TransactionType.TRANSFER.value,
        amount=10000.0,
        timestamp=datetime.now(UTC),
        status=TransactionStatus.COMMITTED.value,
        categorized_by=CategorizationStrategy.RULE.value,
    )
    db_session.add(transfer)
    await db_session.commit()
    await db_session.refresh(transfer)

    assert transfer.source_account_id == src.id
    assert transfer.destination_account_id == dst.id
    assert transfer.transaction_type == "TRANSFER"
    assert transfer.category_id is None


@pytest.mark.asyncio
async def test_split_transaction_and_cascade_delete(db_session: AsyncSession):
    """Test split transaction with line items and cascade deletion."""
    account = Account(
        name="Cash", institution="CASH", account_type=AccountType.CASH.value
    )
    cat1 = Category(name="Groceries")
    cat2 = Category(name="Household")
    db_session.add_all([account, cat1, cat2])
    await db_session.commit()

    txn = Transaction(
        source_account_id=account.id,
        transaction_type=TransactionType.EXPENSE.value,
        amount=2500.0,
        timestamp=datetime.now(UTC),
        is_split=True,
        category_id=None,  # Split transactions store category in splits table
        status=TransactionStatus.COMMITTED.value,
    )
    db_session.add(txn)
    await db_session.commit()

    split1 = Split(
        transaction_id=txn.id, category_id=cat1.id, amount=1500.0, note="Food items"
    )
    split2 = Split(
        transaction_id=txn.id,
        category_id=cat2.id,
        amount=1000.0,
        note="Cleaning supplies",
    )
    log = CategorizationLog(
        transaction_id=txn.id,
        action="MANUAL_SPLIT",
        to_category_id=cat1.id,
        strategy="MANUAL",
    )
    db_session.add_all([split1, split2, log])
    await db_session.commit()

    # Load splits via relationship
    stmt = (
        select(Transaction)
        .where(Transaction.id == txn.id)
        .options(
            selectinload(Transaction.splits),
            selectinload(Transaction.categorization_logs),
        )
    )
    result = await db_session.execute(stmt)
    loaded_txn = result.scalar_one()

    assert len(loaded_txn.splits) == 2
    assert sum(s.amount for s in loaded_txn.splits) == 2500.0
    assert len(loaded_txn.categorization_logs) == 1

    # Verify cascade delete
    await db_session.delete(loaded_txn)
    await db_session.commit()

    splits_after = (
        (await db_session.execute(select(Split).where(Split.transaction_id == txn.id)))
        .scalars()
        .all()
    )
    logs_after = (
        (
            await db_session.execute(
                select(CategorizationLog).where(
                    CategorizationLog.transaction_id == txn.id
                )
            )
        )
        .scalars()
        .all()
    )

    assert len(splits_after) == 0
    assert len(logs_after) == 0


@pytest.mark.asyncio
async def test_transaction_unique_txn_ref(db_session: AsyncSession):
    """Test unique constraint on txn_ref."""
    account = Account(
        name="Test", institution="TEST", account_type=AccountType.SAVINGS.value
    )
    db_session.add(account)
    await db_session.commit()

    t1 = Transaction(
        source_account_id=account.id,
        transaction_type=TransactionType.EXPENSE.value,
        amount=100.0,
        timestamp=datetime.now(UTC),
        txn_ref="REF-9999",
    )
    db_session.add(t1)
    await db_session.commit()

    t2 = Transaction(
        source_account_id=account.id,
        transaction_type=TransactionType.EXPENSE.value,
        amount=200.0,
        timestamp=datetime.now(UTC),
        txn_ref="REF-9999",
    )
    db_session.add(t2)
    with pytest.raises(IntegrityError):
        await db_session.commit()

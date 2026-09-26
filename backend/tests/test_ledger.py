from datetime import datetime, timezone
from decimal import Decimal
import pytest
from sqlalchemy import select

from expense_tracker.models.account import Account
from expense_tracker.models.category import Category
from expense_tracker.models.transaction import Transaction, Split
from expense_tracker.services.ledger import LedgerService, SplitItem, SplitMismatchError

@pytest.mark.asyncio
async def test_create_account_zero_balance(async_session):
    account = await LedgerService.create_account(
        async_session,
        name="Cash Wallet",
        institution="CASH",
        account_type="CASH",
        currency="INR",
        initial_balance=Decimal("0.00")
    )
    assert account.id is not None
    assert account.balance == Decimal("0.00")
    
    # Assert no transaction was created
    stmt = select(Transaction).where(Transaction.account_id == account.id)
    result = await async_session.execute(stmt)
    txs = result.scalars().all()
    assert len(txs) == 0

@pytest.mark.asyncio
async def test_create_account_with_initial_balance_creates_audit_tx(async_session):
    account = await LedgerService.create_account(
        async_session,
        name="HDFC Salary",
        institution="HDFC",
        account_type="SAVINGS",
        currency="INR",
        initial_balance=Decimal("50000.00"),
        account_number_last4="1234"
    )
    assert account.id is not None
    assert account.balance == Decimal("50000.00")
    
    # Assert audit transaction was created
    stmt = select(Transaction).where(Transaction.account_id == account.id)
    result = await async_session.execute(stmt)
    txs = result.scalars().all()
    assert len(txs) == 1
    
    tx = txs[0]
    assert tx.amount == Decimal("50000.00")
    assert tx.is_expense is False
    assert tx.is_transfer is False
    assert tx.status == "POSTED"
    assert tx.merchant_name == "Opening Balance"

@pytest.mark.asyncio
async def test_record_expense_deducts_balance(async_session):
    account = await LedgerService.create_account(
        async_session,
        name="ICICI Savings",
        institution="ICICI",
        account_type="SAVINGS",
        currency="INR",
        initial_balance=Decimal("10000.00")
    )
    
    tx = await LedgerService.record_transaction(
        async_session,
        account_id=account.id,
        amount=Decimal("1500.00"),
        merchant_name="Swiggy",
        timestamp=datetime.now(timezone.utc),
        is_expense=True,
        is_transfer=False
    )
    assert tx.id is not None
    
    # Check balance deduction
    await async_session.refresh(account)
    assert account.balance == Decimal("8500.00")

@pytest.mark.asyncio
async def test_record_income_adds_balance(async_session):
    account = await LedgerService.create_account(
        async_session,
        name="SBI Savings",
        institution="SBI",
        account_type="SAVINGS",
        currency="INR",
        initial_balance=Decimal("5000.00")
    )
    
    tx = await LedgerService.record_transaction(
        async_session,
        account_id=account.id,
        amount=Decimal("25000.00"),
        merchant_name="Employer Salary",
        timestamp=datetime.now(timezone.utc),
        is_expense=False,
        is_transfer=False
    )
    assert tx.id is not None
    
    # Check balance addition
    await async_session.refresh(account)
    assert account.balance == Decimal("30000.00")

@pytest.mark.asyncio
async def test_record_transfer_moves_funds_between_accounts(async_session):
    src_account = await LedgerService.create_account(
        async_session,
        name="Source Bank",
        institution="HDFC",
        account_type="SAVINGS",
        currency="INR",
        initial_balance=Decimal("20000.00")
    )
    dst_account = await LedgerService.create_account(
        async_session,
        name="Dest Credit Card",
        institution="ICICI",
        account_type="CREDIT_CARD",
        currency="INR",
        initial_balance=Decimal("-5000.00")
    )
    
    tx = await LedgerService.record_transaction(
        async_session,
        account_id=src_account.id,
        destination_account_id=dst_account.id,
        amount=Decimal("5000.00"),
        merchant_name="Credit Card Bill Payment",
        timestamp=datetime.now(timezone.utc),
        is_expense=False,
        is_transfer=True
    )
    assert tx.id is not None
    assert tx.is_transfer is True
    
    await async_session.refresh(src_account)
    await async_session.refresh(dst_account)
    
    assert src_account.balance == Decimal("15000.00")
    assert dst_account.balance == Decimal("0.00")
    
    # Total net worth invariant: 20000 + (-5000) = 15000 == 15000 + 0
    assert (src_account.balance + dst_account.balance) == Decimal("15000.00")

@pytest.mark.asyncio
async def test_split_transaction_success(async_session):
    account = await LedgerService.create_account(
        async_session,
        name="Spend Account",
        institution="HDFC",
        account_type="SAVINGS",
        currency="INR",
        initial_balance=Decimal("10000.00")
    )
    cat_food = Category(name="Food", color="#FF0000")
    cat_supplies = Category(name="Supplies", color="#00FF00")
    async_session.add_all([cat_food, cat_supplies])
    await async_session.commit()
    
    tx = await LedgerService.record_transaction(
        async_session,
        account_id=account.id,
        amount=Decimal("3000.00"),
        merchant_name="Supermarket",
        timestamp=datetime.now(timezone.utc),
        is_expense=True
    )
    
    splits = [
        SplitItem(category_id=cat_food.id, amount=Decimal("2200.00"), note="Groceries"),
        SplitItem(category_id=cat_supplies.id, amount=Decimal("800.00"), note="Cleaning Supplies"),
    ]
    created_splits = await LedgerService.split_transaction(async_session, tx.id, splits)
    assert len(created_splits) == 2
    
    stmt = select(Split).where(Split.transaction_id == tx.id)
    res = await async_session.execute(stmt)
    db_splits = res.scalars().all()
    assert len(db_splits) == 2
    assert sum(s.amount for s in db_splits) == Decimal("3000.00")

@pytest.mark.asyncio
async def test_split_transaction_mismatch_raises_error_and_rolls_back(async_session):
    account = await LedgerService.create_account(
        async_session,
        name="Spend Account 2",
        institution="HDFC",
        account_type="SAVINGS",
        currency="INR",
        initial_balance=Decimal("10000.00")
    )
    cat_food = Category(name="Food 2", color="#FF0000")
    async_session.add(cat_food)
    await async_session.commit()
    
    tx = await LedgerService.record_transaction(
        async_session,
        account_id=account.id,
        amount=Decimal("3000.00"),
        merchant_name="Supermarket 2",
        timestamp=datetime.now(timezone.utc),
        is_expense=True
    )
    
    # Split amounts sum to 2500 != 3000
    invalid_splits = [
        SplitItem(category_id=cat_food.id, amount=Decimal("2500.00"), note="Groceries")
    ]
    
    with pytest.raises(SplitMismatchError):
        await LedgerService.split_transaction(async_session, tx.id, invalid_splits)
        
    # Verify no split was saved
    stmt = select(Split).where(Split.transaction_id == tx.id)
    res = await async_session.execute(stmt)
    db_splits = res.scalars().all()
    assert len(db_splits) == 0

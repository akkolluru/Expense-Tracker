"""Unit and Invariant tests for LedgerService."""

from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountType
from app.models.category import Category
from app.models.split import Split
from app.models.transaction import Transaction, TransactionStatus, TransactionType
from app.services.ledger import (
    AccountNotFoundError,
    InactiveAccountError,
    InvalidTransactionError,
    InvalidTransferError,
    LedgerService,
    SplitCreateData,
    SplitSumMismatchError,
    TransactionCreateData,
    TransactionNotFoundError,
    TransactionUpdateData,
)


@pytest.mark.asyncio
async def test_record_expense_decrements_source_account_balance(db_session: AsyncSession):
    """An EXPENSE transaction must deduct the amount from source account balance."""
    account = Account(
        name="HDFC Salary Account",
        institution="HDFC Bank",
        account_type=AccountType.SAVINGS.value,
        current_balance=10000.0,
    )
    category = Category(name="Food & Dining")
    db_session.add_all([account, category])
    await db_session.flush()

    service = LedgerService(db_session)
    data = TransactionCreateData(
        transaction_type=TransactionType.EXPENSE,
        amount=500.0,
        timestamp=datetime.now(UTC),
        source_account_id=account.id,
        category_id=category.id,
        status=TransactionStatus.COMMITTED,
    )

    txn = await service.record_transaction(data)
    await db_session.flush()

    assert txn.id is not None
    assert txn.amount == 500.0
    assert txn.transaction_type == TransactionType.EXPENSE.value
    assert txn.status == TransactionStatus.COMMITTED.value

    # Verify source account balance is updated in DB
    refreshed_account = await db_session.get(Account, account.id)
    assert refreshed_account is not None
    assert refreshed_account.current_balance == 9500.0


@pytest.mark.asyncio
async def test_record_income_increments_destination_account_balance(db_session: AsyncSession):
    """An INCOME transaction must add the amount to destination account balance."""
    account = Account(
        name="ICICI Savings",
        institution="ICICI Bank",
        account_type=AccountType.SAVINGS.value,
        current_balance=2000.0,
    )
    category = Category(name="Salary")
    db_session.add_all([account, category])
    await db_session.flush()

    service = LedgerService(db_session)
    data = TransactionCreateData(
        transaction_type=TransactionType.INCOME,
        amount=75000.0,
        timestamp=datetime.now(UTC),
        destination_account_id=account.id,
        category_id=category.id,
        status=TransactionStatus.COMMITTED,
    )

    txn = await service.record_transaction(data)
    await db_session.flush()

    assert txn.id is not None
    assert txn.amount == 75000.0
    assert txn.transaction_type == TransactionType.INCOME.value

    refreshed_account = await db_session.get(Account, account.id)
    assert refreshed_account is not None
    assert refreshed_account.current_balance == 77000.0


@pytest.mark.asyncio
async def test_record_transaction_rejects_non_positive_amount(db_session: AsyncSession):
    """Transactions with amount <= 0 must be rejected."""
    account = Account(
        name="Cash",
        institution="Physical",
        account_type=AccountType.CASH.value,
        current_balance=500.0,
    )
    category = Category(name="General")
    db_session.add_all([account, category])
    await db_session.flush()

    service = LedgerService(db_session)

    with pytest.raises(InvalidTransactionError, match="positive"):
        await service.record_transaction(
            TransactionCreateData(
                transaction_type=TransactionType.EXPENSE,
                amount=0.0,
                timestamp=datetime.now(UTC),
                source_account_id=account.id,
                category_id=category.id,
            )
        )

    with pytest.raises(InvalidTransactionError, match="positive"):
        await service.record_transaction(
            TransactionCreateData(
                transaction_type=TransactionType.EXPENSE,
                amount=-100.0,
                timestamp=datetime.now(UTC),
                source_account_id=account.id,
                category_id=category.id,
            )
        )


@pytest.mark.asyncio
async def test_record_expense_requires_valid_source_account(db_session: AsyncSession):
    """Expense requires a valid, existing source account."""
    category = Category(name="Shopping")
    db_session.add(category)
    await db_session.flush()

    service = LedgerService(db_session)

    # Missing source_account_id
    with pytest.raises(InvalidTransactionError, match="source_account_id"):
        await service.record_transaction(
            TransactionCreateData(
                transaction_type=TransactionType.EXPENSE,
                amount=100.0,
                timestamp=datetime.now(UTC),
                source_account_id=None,
                category_id=category.id,
            )
        )

    # Non-existent source_account_id
    with pytest.raises(AccountNotFoundError):
        await service.record_transaction(
            TransactionCreateData(
                transaction_type=TransactionType.EXPENSE,
                amount=100.0,
                timestamp=datetime.now(UTC),
                source_account_id="non-existent-id",
                category_id=category.id,
            )
        )


@pytest.mark.asyncio
async def test_record_income_requires_valid_destination_account(db_session: AsyncSession):
    """Income requires a valid, existing destination account."""
    category = Category(name="Interest")
    db_session.add(category)
    await db_session.flush()

    service = LedgerService(db_session)

    # Missing destination_account_id
    with pytest.raises(InvalidTransactionError, match="destination_account_id"):
        await service.record_transaction(
            TransactionCreateData(
                transaction_type=TransactionType.INCOME,
                amount=250.0,
                timestamp=datetime.now(UTC),
                destination_account_id=None,
                category_id=category.id,
            )
        )

    # Non-existent destination_account_id
    with pytest.raises(AccountNotFoundError):
        await service.record_transaction(
            TransactionCreateData(
                transaction_type=TransactionType.INCOME,
                amount=250.0,
                timestamp=datetime.now(UTC),
                destination_account_id="non-existent-dest",
                category_id=category.id,
            )
        )


@pytest.mark.asyncio
async def test_record_transaction_rejects_inactive_account(db_session: AsyncSession):
    """Transactions targeting inactive accounts must be rejected."""
    account = Account(
        name="Closed Account",
        institution="Old Bank",
        account_type=AccountType.SAVINGS.value,
        current_balance=0.0,
        is_active=False,
    )
    category = Category(name="Misc")
    db_session.add_all([account, category])
    await db_session.flush()

    service = LedgerService(db_session)

    with pytest.raises(InactiveAccountError):
        await service.record_transaction(
            TransactionCreateData(
                transaction_type=TransactionType.EXPENSE,
                amount=100.0,
                timestamp=datetime.now(UTC),
                source_account_id=account.id,
                category_id=category.id,
            )
        )


@pytest.mark.asyncio
async def test_record_transfer_double_entry_balances(db_session: AsyncSession):
    """Transfer debits source account, credits destination account, and maintains net balance."""
    source = Account(
        name="HDFC Savings",
        institution="HDFC Bank",
        account_type=AccountType.SAVINGS.value,
        current_balance=50000.0,
    )
    dest = Account(
        name="HDFC Credit Card",
        institution="HDFC Bank",
        account_type=AccountType.CREDIT_CARD.value,
        current_balance=-15000.0,
    )
    db_session.add_all([source, dest])
    await db_session.flush()

    service = LedgerService(db_session)
    data = TransactionCreateData(
        transaction_type=TransactionType.TRANSFER,
        amount=15000.0,
        timestamp=datetime.now(UTC),
        source_account_id=source.id,
        destination_account_id=dest.id,
        status=TransactionStatus.COMMITTED,
    )

    txn = await service.record_transaction(data)
    await db_session.flush()

    assert txn.id is not None
    assert txn.transaction_type == TransactionType.TRANSFER.value
    assert txn.amount == 15000.0

    refreshed_source = await db_session.get(Account, source.id)
    refreshed_dest = await db_session.get(Account, dest.id)
    assert refreshed_source is not None
    assert refreshed_dest is not None

    # Source was debited 15k (50k -> 35k)
    assert refreshed_source.current_balance == 35000.0
    # Dest was credited 15k (-15k -> 0k)
    assert refreshed_dest.current_balance == 0.0
    # Net sum across both accounts is unchanged (35000 + 0 == 50000 + (-15000))
    assert refreshed_source.current_balance + refreshed_dest.current_balance == 35000.0


@pytest.mark.asyncio
async def test_record_transfer_rejects_identical_source_and_destination(db_session: AsyncSession):
    """Transfer to the same account must be rejected with InvalidTransferError."""
    account = Account(
        name="HDFC Savings",
        institution="HDFC Bank",
        account_type=AccountType.SAVINGS.value,
        current_balance=10000.0,
    )
    db_session.add(account)
    await db_session.flush()

    service = LedgerService(db_session)

    with pytest.raises(InvalidTransferError, match="cannot be identical"):
        await service.record_transaction(
            TransactionCreateData(
                transaction_type=TransactionType.TRANSFER,
                amount=1000.0,
                timestamp=datetime.now(UTC),
                source_account_id=account.id,
                destination_account_id=account.id,
            )
        )


@pytest.mark.asyncio
async def test_record_transfer_rejects_missing_accounts(db_session: AsyncSession):
    """Transfer requires both source and destination accounts to exist."""
    account = Account(
        name="Main Checking",
        institution="Bank",
        account_type=AccountType.SAVINGS.value,
        current_balance=5000.0,
    )
    db_session.add(account)
    await db_session.flush()

    service = LedgerService(db_session)

    # Missing destination_account_id
    with pytest.raises(InvalidTransferError, match="both source_account_id and destination_account_id"):
        await service.record_transaction(
            TransactionCreateData(
                transaction_type=TransactionType.TRANSFER,
                amount=500.0,
                timestamp=datetime.now(UTC),
                source_account_id=account.id,
                destination_account_id=None,
            )
        )

    # Non-existent destination account
    with pytest.raises(AccountNotFoundError):
        await service.record_transaction(
            TransactionCreateData(
                transaction_type=TransactionType.TRANSFER,
                amount=500.0,
                timestamp=datetime.now(UTC),
                source_account_id=account.id,
                destination_account_id="non-existent-dest",
            )
        )


@pytest.mark.asyncio
async def test_record_split_transaction_success(db_session: AsyncSession):
    """Split transaction creates split rows and clears parent category_id."""
    account = Account(
        name="HDFC Checking",
        institution="HDFC Bank",
        account_type=AccountType.SAVINGS.value,
        current_balance=10000.0,
    )
    cat_groceries = Category(name="Groceries")
    cat_household = Category(name="Household")
    db_session.add_all([account, cat_groceries, cat_household])
    await db_session.flush()

    service = LedgerService(db_session)
    data = TransactionCreateData(
        transaction_type=TransactionType.EXPENSE,
        amount=1500.0,
        timestamp=datetime.now(UTC),
        source_account_id=account.id,
        is_split=True,
        splits=[
            SplitCreateData(category_id=cat_groceries.id, amount=1000.0, note="Veggies & Fruits"),
            SplitCreateData(category_id=cat_household.id, amount=500.0, note="Cleaning supplies"),
        ],
        status=TransactionStatus.COMMITTED,
    )

    txn = await service.record_transaction(data)
    await db_session.flush()

    assert txn.id is not None
    assert txn.is_split is True
    assert txn.category_id is None
    assert txn.sub_category_id is None

    # Verify split rows in DB
    splits_stmt = select(Split).where(Split.transaction_id == txn.id)
    splits_result = await db_session.execute(splits_stmt)
    splits = splits_result.scalars().all()
    assert len(splits) == 2
    assert {s.amount for s in splits} == {1000.0, 500.0}

    # Verify account balance was deducted
    refreshed_account = await db_session.get(Account, account.id)
    assert refreshed_account is not None
    assert refreshed_account.current_balance == 8500.0


@pytest.mark.asyncio
async def test_record_split_sum_mismatch_raises_error(db_session: AsyncSession):
    """If sum(splits.amount) != txn.amount, SplitSumMismatchError must be raised."""
    account = Account(
        name="HDFC Checking",
        institution="HDFC Bank",
        account_type=AccountType.SAVINGS.value,
        current_balance=10000.0,
    )
    cat = Category(name="Food")
    db_session.add_all([account, cat])
    await db_session.flush()

    service = LedgerService(db_session)
    data = TransactionCreateData(
        transaction_type=TransactionType.EXPENSE,
        amount=1000.0,
        timestamp=datetime.now(UTC),
        source_account_id=account.id,
        is_split=True,
        splits=[
            SplitCreateData(category_id=cat.id, amount=600.0),
            SplitCreateData(category_id=cat.id, amount=300.0),  # Sum = 900 != 1000
        ],
    )

    with pytest.raises(SplitSumMismatchError, match="Split sum"):
        await service.record_transaction(data)


@pytest.mark.asyncio
async def test_record_split_validation_errors(db_session: AsyncSession):
    """Split validation rejects empty splits list, non-positive split amount, or non-split with splits."""
    account = Account(
        name="Cash",
        institution="Cash",
        account_type=AccountType.CASH.value,
        current_balance=5000.0,
    )
    cat = Category(name="General")
    db_session.add_all([account, cat])
    await db_session.flush()

    service = LedgerService(db_session)

    # Empty splits list when is_split=True
    with pytest.raises(InvalidTransactionError, match="at least one split"):
        await service.record_transaction(
            TransactionCreateData(
                transaction_type=TransactionType.EXPENSE,
                amount=500.0,
                timestamp=datetime.now(UTC),
                source_account_id=account.id,
                is_split=True,
                splits=[],
            )
        )

    # Split amount <= 0
    with pytest.raises(InvalidTransactionError, match="must be positive"):
        await service.record_transaction(
            TransactionCreateData(
                transaction_type=TransactionType.EXPENSE,
                amount=500.0,
                timestamp=datetime.now(UTC),
                source_account_id=account.id,
                is_split=True,
                splits=[
                    SplitCreateData(category_id=cat.id, amount=500.0),
                    SplitCreateData(category_id=cat.id, amount=0.0),
                ],
            )
        )

    # is_split=False but splits provided
    with pytest.raises(InvalidTransactionError, match="is_split is False"):
        await service.record_transaction(
            TransactionCreateData(
                transaction_type=TransactionType.EXPENSE,
                amount=500.0,
                timestamp=datetime.now(UTC),
                source_account_id=account.id,
                category_id=cat.id,
                is_split=False,
                splits=[SplitCreateData(category_id=cat.id, amount=500.0)],
            )
        )


@pytest.mark.asyncio
async def test_pending_review_transaction_does_not_affect_balance_until_approved(
    db_session: AsyncSession,
):
    """Pending review transaction leaves balance untouched; recategorize/approve applies balance."""
    account = Account(
        name="HDFC Salary",
        institution="HDFC Bank",
        account_type=AccountType.SAVINGS.value,
        current_balance=20000.0,
    )
    cat = Category(name="Utilities")
    db_session.add_all([account, cat])
    await db_session.flush()

    service = LedgerService(db_session)
    data = TransactionCreateData(
        transaction_type=TransactionType.EXPENSE,
        amount=2000.0,
        timestamp=datetime.now(UTC),
        source_account_id=account.id,
        status=TransactionStatus.PENDING_REVIEW,
    )

    txn = await service.record_transaction(data)
    await db_session.flush()

    # Balance should NOT be touched while pending review
    refreshed_acc = await db_session.get(Account, account.id)
    assert refreshed_acc is not None
    assert refreshed_acc.current_balance == 20000.0

    # Now approve / recategorize
    updated_txn = await service.recategorize_transaction(
        transaction_id=txn.id,
        category_id=cat.id,
        status=TransactionStatus.COMMITTED,
        categorized_by="MANUAL",
    )
    await db_session.flush()

    assert updated_txn.status == TransactionStatus.COMMITTED.value
    assert updated_txn.category_id == cat.id
    assert updated_txn.categorized_by == "MANUAL"

    # Now balance must reflect deduction
    refreshed_acc = await db_session.get(Account, account.id)
    assert refreshed_acc is not None
    assert refreshed_acc.current_balance == 18000.0


@pytest.mark.asyncio
async def test_approve_pending_preserves_existing_category(db_session: AsyncSession):
    """Approving a pending transaction without passing a category preserves pre-existing category."""
    account = Account(
        name="HDFC Salary",
        institution="HDFC Bank",
        account_type=AccountType.SAVINGS.value,
        current_balance=20000.0,
    )
    cat = Category(name="Groceries")
    db_session.add_all([account, cat])
    await db_session.flush()

    service = LedgerService(db_session)
    data = TransactionCreateData(
        transaction_type=TransactionType.EXPENSE,
        amount=1500.0,
        timestamp=datetime.now(UTC),
        source_account_id=account.id,
        category_id=cat.id,
        status=TransactionStatus.PENDING_REVIEW,
    )

    txn = await service.record_transaction(data)
    await db_session.flush()

    # Approve without specifying category_id (preserves cat.id)
    updated_txn = await service.recategorize_transaction(
        transaction_id=txn.id,
        status=TransactionStatus.COMMITTED,
    )
    await db_session.flush()

    assert updated_txn.status == TransactionStatus.COMMITTED.value
    assert updated_txn.category_id == cat.id

    refreshed_acc = await db_session.get(Account, account.id)
    assert refreshed_acc is not None
    assert refreshed_acc.current_balance == 18500.0


@pytest.mark.asyncio
async def test_update_transaction_amount_adjusts_balance(db_session: AsyncSession):
    """Updating transaction amount reverts old balance impact and applies new one."""
    account = Account(
        name="Axis Savings",
        institution="Axis Bank",
        account_type=AccountType.SAVINGS.value,
        current_balance=10000.0,
    )
    cat = Category(name="Dining")
    db_session.add_all([account, cat])
    await db_session.flush()

    service = LedgerService(db_session)
    txn = await service.record_transaction(
        TransactionCreateData(
            transaction_type=TransactionType.EXPENSE,
            amount=500.0,
            timestamp=datetime.now(UTC),
            source_account_id=account.id,
            category_id=cat.id,
            status=TransactionStatus.COMMITTED,
        )
    )
    await db_session.flush()

    # Initial balance: 10000 - 500 = 9500
    refreshed_acc = await db_session.get(Account, account.id)
    assert refreshed_acc is not None
    assert refreshed_acc.current_balance == 9500.0

    # Update amount to 1200.0
    await service.update_transaction(
        transaction_id=txn.id,
        data=TransactionUpdateData(amount=1200.0),
    )
    await db_session.flush()

    # Balance should now be 10000 - 1200 = 8800
    refreshed_acc = await db_session.get(Account, account.id)
    assert refreshed_acc is not None
    assert refreshed_acc.current_balance == 8800.0


@pytest.mark.asyncio
async def test_update_transaction_reassign_accounts(db_session: AsyncSession):
    """Updating transaction source account reverts old account balance and debits new account."""
    acc1 = Account(
        name="Account 1",
        institution="Bank 1",
        account_type=AccountType.SAVINGS.value,
        current_balance=10000.0,
    )
    acc2 = Account(
        name="Account 2",
        institution="Bank 2",
        account_type=AccountType.SAVINGS.value,
        current_balance=10000.0,
    )
    cat = Category(name="General")
    db_session.add_all([acc1, acc2, cat])
    await db_session.flush()

    service = LedgerService(db_session)
    txn = await service.record_transaction(
        TransactionCreateData(
            transaction_type=TransactionType.EXPENSE,
            amount=3000.0,
            timestamp=datetime.now(UTC),
            source_account_id=acc1.id,
            category_id=cat.id,
            status=TransactionStatus.COMMITTED,
        )
    )
    await db_session.flush()

    # acc1: 7000, acc2: 10000
    r1 = await db_session.get(Account, acc1.id)
    r2 = await db_session.get(Account, acc2.id)
    assert r1 is not None and r1.current_balance == 7000.0
    assert r2 is not None and r2.current_balance == 10000.0

    # Reassign source_account to acc2
    await service.update_transaction(
        transaction_id=txn.id,
        data=TransactionUpdateData(source_account_id=acc2.id),
    )
    await db_session.flush()

    # acc1 restored to 10000, acc2 debited to 7000
    r1 = await db_session.get(Account, acc1.id)
    r2 = await db_session.get(Account, acc2.id)
    assert r1 is not None and r1.current_balance == 10000.0
    assert r2 is not None and r2.current_balance == 7000.0


@pytest.mark.asyncio
async def test_delete_transaction_reverts_balances(db_session: AsyncSession):
    """Deleting a committed transaction restores account balances."""
    source = Account(
        name="Source Acc",
        institution="Bank",
        account_type=AccountType.SAVINGS.value,
        current_balance=10000.0,
    )
    dest = Account(
        name="Dest Acc",
        institution="Bank",
        account_type=AccountType.SAVINGS.value,
        current_balance=5000.0,
    )
    db_session.add_all([source, dest])
    await db_session.flush()

    service = LedgerService(db_session)
    txn = await service.record_transaction(
        TransactionCreateData(
            transaction_type=TransactionType.TRANSFER,
            amount=4000.0,
            timestamp=datetime.now(UTC),
            source_account_id=source.id,
            destination_account_id=dest.id,
            status=TransactionStatus.COMMITTED,
        )
    )
    await db_session.flush()

    # Post-transfer: source = 6000, dest = 9000
    r_src = await db_session.get(Account, source.id)
    r_dst = await db_session.get(Account, dest.id)
    assert r_src is not None and r_src.current_balance == 6000.0
    assert r_dst is not None and r_dst.current_balance == 9000.0

    # Delete the transfer
    await service.delete_transaction(txn.id)
    await db_session.flush()

    # Balances must be restored: source = 10000, dest = 5000
    r_src = await db_session.get(Account, source.id)
    r_dst = await db_session.get(Account, dest.id)
    assert r_src is not None and r_src.current_balance == 10000.0
    assert r_dst is not None and r_dst.current_balance == 5000.0

    # Transaction is gone
    deleted_txn = await db_session.get(Transaction, txn.id)
    assert deleted_txn is None


@pytest.mark.asyncio
async def test_adjust_account_balance_success(db_session: AsyncSession):
    """Directly adjusting account balance updates current_balance."""
    account = Account(
        name="Wallet Cash",
        institution="Physical",
        account_type=AccountType.CASH.value,
        current_balance=2500.0,
    )
    db_session.add(account)
    await db_session.flush()

    service = LedgerService(db_session)
    updated_acc = await service.adjust_account_balance(account.id, new_balance=1800.0, note="Manual physical cash count")
    await db_session.flush()

    assert updated_acc.current_balance == 1800.0

    balance = await service.get_account_balance(account.id)
    assert balance == 1800.0


@pytest.mark.asyncio
async def test_adjust_account_balance_errors(db_session: AsyncSession):
    """Adjust balance rejects non-existent or inactive accounts."""
    account = Account(
        name="Closed Vault",
        institution="Bank",
        account_type=AccountType.SAVINGS.value,
        current_balance=0.0,
        is_active=False,
    )
    db_session.add(account)
    await db_session.flush()

    service = LedgerService(db_session)

    with pytest.raises(AccountNotFoundError):
        await service.adjust_account_balance("non-existent-acc", new_balance=100.0)

    with pytest.raises(InactiveAccountError):
        await service.adjust_account_balance(account.id, new_balance=100.0)


@pytest.mark.asyncio
async def test_not_found_errors_on_transaction_operations(db_session: AsyncSession):
    """Recategorize, update, and delete raise TransactionNotFoundError for non-existent IDs."""
    service = LedgerService(db_session)

    with pytest.raises(TransactionNotFoundError):
        await service.recategorize_transaction("missing-id", category_id=1)

    with pytest.raises(TransactionNotFoundError):
        await service.update_transaction("missing-id", TransactionUpdateData(amount=100.0))

    with pytest.raises(TransactionNotFoundError):
        await service.delete_transaction("missing-id")


@pytest.mark.asyncio
async def test_recategorize_transition_to_excluded_reverts_balance(db_session: AsyncSession):
    """Transitioning a COMMITTED transaction to EXCLUDED reverts its balance impact."""
    account = Account(
        name="HDFC Card",
        institution="HDFC Bank",
        account_type=AccountType.CREDIT_CARD.value,
        current_balance=0.0,
    )
    cat = Category(name="Electronics")
    db_session.add_all([account, cat])
    await db_session.flush()

    service = LedgerService(db_session)
    txn = await service.record_transaction(
        TransactionCreateData(
            transaction_type=TransactionType.EXPENSE,
            amount=5000.0,
            timestamp=datetime.now(UTC),
            source_account_id=account.id,
            category_id=cat.id,
            status=TransactionStatus.COMMITTED,
        )
    )
    await db_session.flush()

    # Balance debited: 0 - 5000 = -5000
    refreshed_acc = await db_session.get(Account, account.id)
    assert refreshed_acc is not None
    assert refreshed_acc.current_balance == -5000.0

    # Mark EXCLUDED
    await service.recategorize_transaction(
        transaction_id=txn.id,
        category_id=cat.id,
        status=TransactionStatus.EXCLUDED,
    )
    await db_session.flush()

    # Balance restored to 0.0
    refreshed_acc = await db_session.get(Account, account.id)
    assert refreshed_acc is not None
    assert refreshed_acc.current_balance == 0.0


@pytest.mark.asyncio
async def test_update_transaction_type_conversion(db_session: AsyncSession):
    """Converting an EXPENSE to a TRANSFER adjusts source and destination balances correctly."""
    acc_src = Account(
        name="Savings",
        institution="Bank",
        account_type=AccountType.SAVINGS.value,
        current_balance=10000.0,
    )
    acc_dst = Account(
        name="Credit Card",
        institution="Bank",
        account_type=AccountType.CREDIT_CARD.value,
        current_balance=-5000.0,
    )
    cat = Category(name="General")
    db_session.add_all([acc_src, acc_dst, cat])
    await db_session.flush()

    service = LedgerService(db_session)
    # Initially created as EXPENSE on acc_src (deducted 2000 from acc_src: 10000 -> 8000)
    txn = await service.record_transaction(
        TransactionCreateData(
            transaction_type=TransactionType.EXPENSE,
            amount=2000.0,
            timestamp=datetime.now(UTC),
            source_account_id=acc_src.id,
            category_id=cat.id,
            status=TransactionStatus.COMMITTED,
        )
    )
    await db_session.flush()

    # Convert to TRANSFER from acc_src to acc_dst
    await service.update_transaction(
        transaction_id=txn.id,
        data=TransactionUpdateData(
            transaction_type=TransactionType.TRANSFER,
            destination_account_id=acc_dst.id,
        ),
    )
    await db_session.flush()

    # acc_src is still debited 2000 (reverted then re-debited): 8000
    # acc_dst is credited 2000: -5000 + 2000 = -3000
    r_src = await db_session.get(Account, acc_src.id)
    r_dst = await db_session.get(Account, acc_dst.id)
    assert r_src is not None and r_src.current_balance == 8000.0
    assert r_dst is not None and r_dst.current_balance == -3000.0


@pytest.mark.asyncio
async def test_update_split_items_and_mismatch_error(db_session: AsyncSession):
    """Updating split items validates the new sum against amount."""
    account = Account(
        name="Main",
        institution="Bank",
        account_type=AccountType.SAVINGS.value,
        current_balance=10000.0,
    )
    c1 = Category(name="Groceries")
    c2 = Category(name="Household")
    c3 = Category(name="Entertainment")
    db_session.add_all([account, c1, c2, c3])
    await db_session.flush()

    service = LedgerService(db_session)
    txn = await service.record_transaction(
        TransactionCreateData(
            transaction_type=TransactionType.EXPENSE,
            amount=1000.0,
            timestamp=datetime.now(UTC),
            source_account_id=account.id,
            is_split=True,
            splits=[
                SplitCreateData(category_id=c1.id, amount=600.0),
                SplitCreateData(category_id=c2.id, amount=400.0),
            ],
            status=TransactionStatus.COMMITTED,
        )
    )
    await db_session.flush()

    # Update splits to 3 categories matching 1000
    updated_txn = await service.update_transaction(
        transaction_id=txn.id,
        data=TransactionUpdateData(
            splits=[
                SplitCreateData(category_id=c1.id, amount=500.0),
                SplitCreateData(category_id=c2.id, amount=300.0),
                SplitCreateData(category_id=c3.id, amount=200.0),
            ]
        ),
    )
    await db_session.flush()

    assert len(updated_txn.splits) == 3
    assert {s.amount for s in updated_txn.splits} == {500.0, 300.0, 200.0}

    # Updating splits with mismatched sum raises error
    with pytest.raises(SplitSumMismatchError):
        await service.update_transaction(
            transaction_id=txn.id,
            data=TransactionUpdateData(
                splits=[
                    SplitCreateData(category_id=c1.id, amount=500.0),
                    SplitCreateData(category_id=c2.id, amount=100.0),  # sum=600 != 1000
                ]
            ),
        )

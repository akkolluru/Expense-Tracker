"""LedgerService: Core financial transaction and double-entry ledger management."""

import logging
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.account import Account
from app.models.split import Split
from app.models.transaction import (
    Transaction,
    TransactionStatus,
    TransactionType,
)

logger = logging.getLogger(__name__)


# ── Domain Exceptions ────────────────────────────────────────────────────────


class LedgerError(Exception):
    """Base exception for all ledger-related errors."""


class AccountNotFoundError(LedgerError):
    """Raised when a referenced account does not exist."""


class InactiveAccountError(LedgerError):
    """Raised when an operation targets an inactive account."""


class TransactionNotFoundError(LedgerError):
    """Raised when a referenced transaction does not exist."""


class SplitSumMismatchError(LedgerError):
    """Raised when sum of splits does not match the transaction amount."""


class InvalidTransferError(LedgerError):
    """Raised when transfer invariants are violated (e.g. same source and destination)."""


class InvalidTransactionError(LedgerError):
    """Raised when a transaction payload violates domain invariants."""


# ── Data Transfer Objects (DTOs) ─────────────────────────────────────────────


@dataclass
class SplitCreateData:
    category_id: int
    amount: float
    sub_category_id: int | None = None
    note: str | None = None


@dataclass
class TransactionCreateData:
    transaction_type: TransactionType
    amount: float
    timestamp: datetime
    source_account_id: str | None = None
    destination_account_id: str | None = None
    currency: str = "INR"
    vpa: str | None = None
    merchant_name: str | None = None
    raw_merchant_name: str | None = None
    category_id: int | None = None
    sub_category_id: int | None = None
    is_split: bool = False
    splits: list[SplitCreateData] = field(default_factory=list)
    group_id: str | None = None
    is_group_locked: bool = False
    status: TransactionStatus = TransactionStatus.COMMITTED
    categorized_by: str | None = None
    txn_ref: str | None = None
    raw_message_id: str | None = None
    notes: str | None = None


@dataclass
class TransactionUpdateData:
    transaction_type: TransactionType | None = None
    amount: float | None = None
    timestamp: datetime | None = None
    source_account_id: str | None = None
    destination_account_id: str | None = None
    currency: str | None = None
    vpa: str | None = None
    merchant_name: str | None = None
    raw_merchant_name: str | None = None
    category_id: int | None = None
    sub_category_id: int | None = None
    is_split: bool | None = None
    splits: list[SplitCreateData] | None = None
    group_id: str | None = None
    is_group_locked: bool | None = None
    status: TransactionStatus | None = None
    categorized_by: str | None = None
    notes: str | None = None


# ── Service Implementation ───────────────────────────────────────────────────


class LedgerService:
    """Manages transactional ledger commits, balance adjustments, and double-entry invariants."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get_active_account(self, account_id: str) -> Account:
        """Fetch an account by ID, verifying existence and active state."""
        account = await self.db.get(Account, account_id)
        if not account:
            raise AccountNotFoundError(f"Account with ID '{account_id}' does not exist.")
        if not account.is_active:
            raise InactiveAccountError(f"Account '{account.name}' ({account_id}) is inactive.")
        return account

    async def _get_transaction_with_splits(self, transaction_id: str) -> Transaction:
        """Fetch transaction by ID eagerly loading splits even if already in identity map."""
        stmt = (
            select(Transaction)
            .where(Transaction.id == transaction_id)
            .options(selectinload(Transaction.splits))
            .execution_options(populate_existing=True)
        )
        result = await self.db.execute(stmt)
        txn = result.scalar_one_or_none()
        if not txn:
            raise TransactionNotFoundError(f"Transaction with ID '{transaction_id}' not found.")
        return txn

    async def _get_transaction_accounts(
        self, source_id: str | None, dest_id: str | None
    ) -> tuple[Account | None, Account | None]:
        """Fetch source and destination account entities if IDs are provided."""
        source = await self.db.get(Account, source_id) if source_id else None
        dest = await self.db.get(Account, dest_id) if dest_id else None
        return source, dest

    @staticmethod
    def _is_balance_active(status: TransactionStatus) -> bool:
        """Return True if transaction status affects account balance."""
        return status in (TransactionStatus.COMMITTED, TransactionStatus.RECONCILED)

    @classmethod
    def _is_status_str_balance_active(cls, status_str: str) -> bool:
        """Helper to check balance active state from a string status value."""
        try:
            return cls._is_balance_active(TransactionStatus(status_str))
        except ValueError:
            return False

    @staticmethod
    def _apply_balance_impact(
        txn_type: TransactionType,
        amount: float,
        source_account: Account | None,
        dest_account: Account | None,
        reverse: bool = False,
    ) -> None:
        """Apply or revert balance adjustments with exact 2-decimal rounding to prevent drift."""
        factor = -1.0 if reverse else 1.0

        if txn_type == TransactionType.EXPENSE:
            if source_account is not None:
                source_account.current_balance = round(source_account.current_balance - (factor * amount), 2)
        elif txn_type == TransactionType.INCOME:
            if dest_account is not None:
                dest_account.current_balance = round(dest_account.current_balance + (factor * amount), 2)
        elif txn_type == TransactionType.TRANSFER:
            if source_account is not None:
                source_account.current_balance = round(source_account.current_balance - (factor * amount), 2)
            if dest_account is not None:
                dest_account.current_balance = round(dest_account.current_balance + (factor * amount), 2)

    @staticmethod
    def _validate_and_build_splits(splits: list[SplitCreateData], txn_amount: float) -> list[Split]:
        """Validate split line items and convert to Split model instances."""
        if not splits:
            raise InvalidTransactionError("Split transaction must contain at least one split line item.")

        for idx, sp in enumerate(splits):
            if sp.amount <= 0:
                raise InvalidTransactionError(f"Split #{idx+1} amount must be positive, got {sp.amount}.")

        splits_sum = round(sum(s.amount for s in splits), 2)
        target_amount = round(txn_amount, 2)
        if splits_sum != target_amount:
            raise SplitSumMismatchError(
                f"Split sum ({splits_sum}) does not match transaction amount ({target_amount})."
            )

        return [
            Split(
                category_id=sp.category_id,
                sub_category_id=sp.sub_category_id,
                amount=sp.amount,
                note=sp.note,
            )
            for sp in splits
        ]

    async def record_transaction(self, data: TransactionCreateData) -> Transaction:
        """Create and atomically commit an Expense, Income, or Transfer transaction."""
        if data.amount <= 0:
            raise InvalidTransactionError(f"Transaction amount must be positive, got {data.amount}.")

        source_account: Account | None = None
        dest_account: Account | None = None

        if data.transaction_type == TransactionType.EXPENSE:
            if not data.source_account_id:
                raise InvalidTransactionError("Expense transaction requires a source_account_id.")
            source_account = await self._get_active_account(data.source_account_id)

        elif data.transaction_type == TransactionType.INCOME:
            if not data.destination_account_id:
                raise InvalidTransactionError("Income transaction requires a destination_account_id.")
            dest_account = await self._get_active_account(data.destination_account_id)

        elif data.transaction_type == TransactionType.TRANSFER:
            if not data.source_account_id or not data.destination_account_id:
                raise InvalidTransferError("Transfer requires both source_account_id and destination_account_id.")
            if data.source_account_id == data.destination_account_id:
                raise InvalidTransferError("Source and destination accounts cannot be identical for a transfer.")
            source_account = await self._get_active_account(data.source_account_id)
            dest_account = await self._get_active_account(data.destination_account_id)

        # Validate Splits
        if data.is_split:
            split_models = self._validate_and_build_splits(data.splits, data.amount)
            final_category_id = None
            final_sub_category_id = None
        else:
            if data.splits:
                raise InvalidTransactionError("Splits cannot be provided when is_split is False.")
            split_models = []
            final_category_id = data.category_id
            final_sub_category_id = data.sub_category_id

        # Apply balance adjustments if active
        if self._is_balance_active(data.status):
            self._apply_balance_impact(
                txn_type=data.transaction_type,
                amount=data.amount,
                source_account=source_account,
                dest_account=dest_account,
                reverse=False,
            )

        txn = Transaction(
            source_account_id=data.source_account_id,
            destination_account_id=data.destination_account_id,
            raw_message_id=data.raw_message_id,
            transaction_type=data.transaction_type.value,
            amount=data.amount,
            currency=data.currency,
            timestamp=data.timestamp,
            vpa=data.vpa,
            merchant_name=data.merchant_name,
            raw_merchant_name=data.raw_merchant_name,
            category_id=final_category_id,
            sub_category_id=final_sub_category_id,
            is_split=data.is_split,
            group_id=data.group_id,
            is_group_locked=data.is_group_locked,
            status=data.status.value,
            categorized_by=data.categorized_by,
            txn_ref=data.txn_ref,
            notes=data.notes,
        )

        if data.is_split:
            txn.splits.extend(split_models)

        self.db.add(txn)
        return txn

    async def recategorize_transaction(
        self,
        transaction_id: str,
        category_id: int | None = None,
        sub_category_id: int | None = None,
        is_split: bool | None = None,
        splits: list[SplitCreateData] | None = None,
        status: TransactionStatus = TransactionStatus.COMMITTED,
        categorized_by: str | None = None,
        is_group_locked: bool | None = None,
    ) -> Transaction:
        """Approve or recategorize an existing transaction."""
        txn = await self._get_transaction_with_splits(transaction_id)

        old_was_active = self._is_status_str_balance_active(txn.status)
        new_is_active = self._is_balance_active(status)

        # Handle balance transition
        if not old_was_active and new_is_active:
            source, dest = await self._get_transaction_accounts(txn.source_account_id, txn.destination_account_id)
            self._apply_balance_impact(
                txn_type=TransactionType(txn.transaction_type),
                amount=txn.amount,
                source_account=source,
                dest_account=dest,
                reverse=False,
            )
        elif old_was_active and not new_is_active:
            source, dest = await self._get_transaction_accounts(txn.source_account_id, txn.destination_account_id)
            self._apply_balance_impact(
                txn_type=TransactionType(txn.transaction_type),
                amount=txn.amount,
                source_account=source,
                dest_account=dest,
                reverse=True,
            )

        target_is_split = is_split if is_split is not None else txn.is_split

        if target_is_split:
            splits_to_use = splits if splits is not None else [
                SplitCreateData(
                    category_id=s.category_id,
                    amount=s.amount,
                    sub_category_id=s.sub_category_id,
                    note=s.note,
                )
                for s in txn.splits
            ]
            split_models = self._validate_and_build_splits(splits_to_use, txn.amount)
            txn.is_split = True
            txn.category_id = None
            txn.sub_category_id = None
            txn.splits.clear()
            txn.splits.extend(split_models)
        else:
            if splits:
                raise InvalidTransactionError("Splits cannot be provided when is_split is False.")
            txn.is_split = False
            if category_id is not None:
                txn.category_id = category_id
            if sub_category_id is not None:
                txn.sub_category_id = sub_category_id
            txn.splits.clear()

        txn.status = status.value
        if categorized_by is not None:
            txn.categorized_by = categorized_by
        if is_group_locked is not None:
            txn.is_group_locked = is_group_locked

        return txn

    async def update_transaction(
        self,
        transaction_id: str,
        data: TransactionUpdateData,
    ) -> Transaction:
        """Atomically update a transaction, reversing old balance impacts and applying new ones."""
        txn = await self._get_transaction_with_splits(transaction_id)

        old_was_active = self._is_status_str_balance_active(txn.status)
        old_type = TransactionType(txn.transaction_type)
        old_amount = txn.amount
        old_source_id = txn.source_account_id
        old_dest_id = txn.destination_account_id

        # Revert old balance impact if it was active
        if old_was_active:
            old_source, old_dest = await self._get_transaction_accounts(old_source_id, old_dest_id)
            self._apply_balance_impact(
                txn_type=old_type,
                amount=old_amount,
                source_account=old_source,
                dest_account=old_dest,
                reverse=True,
            )

        # Compute new values
        new_type = data.transaction_type if data.transaction_type is not None else old_type
        new_amount = data.amount if data.amount is not None else old_amount
        if new_amount <= 0:
            raise InvalidTransactionError(f"Transaction amount must be positive, got {new_amount}.")

        new_source_id = data.source_account_id if data.source_account_id is not None else old_source_id
        new_dest_id = data.destination_account_id if data.destination_account_id is not None else old_dest_id
        new_status = data.status if data.status is not None else TransactionStatus(txn.status)
        new_is_split = data.is_split if data.is_split is not None else txn.is_split

        new_source: Account | None = None
        new_dest: Account | None = None

        if new_type == TransactionType.EXPENSE:
            if not new_source_id:
                raise InvalidTransactionError("Expense transaction requires a source_account_id.")
            new_source = await self._get_active_account(new_source_id)
            new_dest_id = None
        elif new_type == TransactionType.INCOME:
            if not new_dest_id:
                raise InvalidTransactionError("Income transaction requires a destination_account_id.")
            new_dest = await self._get_active_account(new_dest_id)
            new_source_id = None
        elif new_type == TransactionType.TRANSFER:
            if not new_source_id or not new_dest_id:
                raise InvalidTransferError("Transfer requires both source_account_id and destination_account_id.")
            if new_source_id == new_dest_id:
                raise InvalidTransferError("Source and destination accounts cannot be identical for a transfer.")
            new_source = await self._get_active_account(new_source_id)
            new_dest = await self._get_active_account(new_dest_id)

        # Handle Splits update
        if new_is_split:
            splits_to_use = data.splits if data.splits is not None else [
                SplitCreateData(
                    category_id=s.category_id,
                    amount=s.amount,
                    sub_category_id=s.sub_category_id,
                    note=s.note,
                )
                for s in txn.splits
            ]
            split_models = self._validate_and_build_splits(splits_to_use, new_amount)
            txn.is_split = True
            txn.category_id = None
            txn.sub_category_id = None
            txn.splits.clear()
            txn.splits.extend(split_models)
        else:
            if data.splits:
                raise InvalidTransactionError("Splits cannot be provided when is_split is False.")
            txn.is_split = False
            txn.splits.clear()
            if data.category_id is not None:
                txn.category_id = data.category_id
            if data.sub_category_id is not None:
                txn.sub_category_id = data.sub_category_id

        # Update core fields
        txn.transaction_type = new_type.value
        txn.amount = new_amount
        txn.source_account_id = new_source_id
        txn.destination_account_id = new_dest_id
        txn.status = new_status.value

        if data.timestamp is not None:
            txn.timestamp = data.timestamp
        if data.currency is not None:
            txn.currency = data.currency
        if data.vpa is not None:
            txn.vpa = data.vpa
        if data.merchant_name is not None:
            txn.merchant_name = data.merchant_name
        if data.raw_merchant_name is not None:
            txn.raw_merchant_name = data.raw_merchant_name
        if data.group_id is not None:
            txn.group_id = data.group_id
        if data.is_group_locked is not None:
            txn.is_group_locked = data.is_group_locked
        if data.categorized_by is not None:
            txn.categorized_by = data.categorized_by
        if data.notes is not None:
            txn.notes = data.notes

        # Apply new balance impact if active
        if self._is_balance_active(new_status):
            self._apply_balance_impact(
                txn_type=new_type,
                amount=new_amount,
                source_account=new_source,
                dest_account=new_dest,
                reverse=False,
            )

        return txn

    async def delete_transaction(self, transaction_id: str) -> None:
        """Atomically delete a transaction and revert its balance impact."""
        txn = await self.db.get(Transaction, transaction_id)
        if not txn:
            raise TransactionNotFoundError(f"Transaction with ID '{transaction_id}' not found.")

        if self._is_status_str_balance_active(txn.status):
            source, dest = await self._get_transaction_accounts(txn.source_account_id, txn.destination_account_id)
            self._apply_balance_impact(
                txn_type=TransactionType(txn.transaction_type),
                amount=txn.amount,
                source_account=source,
                dest_account=dest,
                reverse=True,
            )

        await self.db.delete(txn)

    async def adjust_account_balance(
        self,
        account_id: str,
        new_balance: float,
        note: str | None = None,
    ) -> Account:
        """Directly adjust an account's balance (for manual reconciliation)."""
        account = await self._get_active_account(account_id)
        account.current_balance = round(new_balance, 2)
        if note:
            logger.info("Adjusted account %s balance to %s (Note: %s)", account_id, new_balance, note)
        return account

    async def get_account_balance(self, account_id: str) -> float:
        """Retrieve the current balance for an account."""
        account = await self._get_active_account(account_id)
        return account.current_balance

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Sequence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.models.account import Account
from expense_tracker.models.transaction import Transaction, Split

class SplitMismatchError(ValueError):
    """Raised when the sum of category split lines does not equal transaction amount."""
    pass

@dataclass
class SplitItem:
    category_id: int
    amount: Decimal
    note: Optional[str] = None

class LedgerService:
    @staticmethod
    async def create_account(
        session: AsyncSession,
        name: str,
        institution: str,
        account_type: str = "SAVINGS",
        currency: str = "INR",
        initial_balance: Decimal = Decimal("0.00"),
        account_number_last4: Optional[str] = None,
    ) -> Account:
        account = Account(
            name=name,
            institution=institution,
            account_type=account_type,
            currency=currency,
            balance=initial_balance,
            account_number_last4=account_number_last4,
            is_active=True,
        )
        session.add(account)
        await session.flush()

        if initial_balance > Decimal("0.00"):
            audit_tx = Transaction(
                account_id=account.id,
                amount=initial_balance,
                currency=currency,
                is_expense=False,
                is_transfer=False,
                is_settlement=False,
                status="POSTED",
                merchant_name="Opening Balance",
                description="Initial account balance",
                categorization_strategy="MANUAL",
                categorization_confidence=1.0,
                timestamp=datetime.now(timezone.utc),
            )
            session.add(audit_tx)
            await session.flush()

        await session.commit()
        await session.refresh(account)
        return account

    @staticmethod
    async def record_transaction(
        session: AsyncSession,
        account_id: int,
        amount: Decimal,
        merchant_name: str,
        timestamp: datetime,
        is_expense: bool = True,
        is_transfer: bool = False,
        destination_account_id: Optional[int] = None,
        category_id: Optional[int] = None,
        suggested_category_id: Optional[int] = None,
        group_id: Optional[int] = None,
        raw_message_id: Optional[int] = None,
        currency: str = "INR",
        is_settlement: bool = False,
        idempotency_key: Optional[str] = None,
        status: str = "POSTED",
        merchant_vpa: Optional[str] = None,
        reference_number: Optional[str] = None,
        description: Optional[str] = None,
        categorization_strategy: str = "MANUAL",
        categorization_confidence: float = 1.0,
    ) -> Transaction:
        account = await session.get(Account, account_id)
        if not account:
            raise ValueError(f"Account {account_id} not found")

        if is_transfer:
            if destination_account_id is None:
                raise ValueError("destination_account_id is required for transfers")
            dest_account = await session.get(Account, destination_account_id)
            if not dest_account:
                raise ValueError(f"Destination account {destination_account_id} not found")
            account.balance -= amount
            dest_account.balance += amount
        elif is_expense:
            account.balance -= amount
        else:
            # Income or settlement deposit
            account.balance += amount

        tx = Transaction(
            account_id=account_id,
            destination_account_id=destination_account_id,
            raw_message_id=raw_message_id,
            category_id=category_id,
            suggested_category_id=suggested_category_id,
            group_id=group_id,
            amount=amount,
            currency=currency,
            is_expense=is_expense,
            is_transfer=is_transfer,
            is_settlement=is_settlement,
            idempotency_key=idempotency_key,
            status=status,
            merchant_name=merchant_name,
            merchant_vpa=merchant_vpa,
            reference_number=reference_number,
            description=description,
            categorization_strategy=categorization_strategy,
            categorization_confidence=categorization_confidence,
            timestamp=timestamp,
        )
        session.add(tx)
        await session.commit()
        await session.refresh(tx)
        return tx

    @staticmethod
    async def split_transaction(
        session: AsyncSession,
        transaction_id: int,
        splits: Sequence[SplitItem],
    ) -> list[Split]:
        tx = await session.get(Transaction, transaction_id)
        if not tx:
            raise ValueError(f"Transaction {transaction_id} not found")

        total_splits = sum(s.amount for s in splits)
        if total_splits != tx.amount:
            raise SplitMismatchError(
                f"Split total ({total_splits}) does not match transaction amount ({tx.amount})"
            )

        created_splits: list[Split] = []
        for item in splits:
            split_rec = Split(
                transaction_id=tx.id,
                category_id=item.category_id,
                amount=item.amount,
                note=item.note,
            )
            session.add(split_rec)
            created_splits.append(split_rec)

        await session.commit()
        for s in created_splits:
            await session.refresh(s)
        return created_splits

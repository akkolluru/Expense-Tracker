from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.models.account import Account
from expense_tracker.models.raw_message import RawMessage
from expense_tracker.models.transaction import Transaction
from expense_tracker.parsers.base import DraftTransaction
from expense_tracker.services.account_resolver import AccountResolver
from expense_tracker.services.ledger import LedgerService


class ReconciliationService:
    @classmethod
    async def find_matching_transaction(
        cls,
        session: AsyncSession,
        draft: DraftTransaction,
        resolved_account_id: int | None = None,
    ) -> Transaction | None:
        timestamp = draft.raw_timestamp or datetime.now(UTC)

        # 1. 7-day sliding window UTR lookup
        if draft.reference_number:
            t_min = timestamp - timedelta(days=7)
            t_max = timestamp + timedelta(days=7)
            stmt = select(Transaction).where(
                Transaction.reference_number == draft.reference_number,
                Transaction.timestamp >= t_min,
                Transaction.timestamp <= t_max,
            )
            res = await session.execute(stmt)
            match = res.scalar_one_or_none()
            if match:
                return match

        # 2. Fallback 10-minute sliding window on amount and account
        t_min_10m = timestamp - timedelta(minutes=10)
        t_max_10m = timestamp + timedelta(minutes=10)
        stmt_fb = select(Transaction).where(
            Transaction.amount == draft.amount,
            Transaction.is_expense == draft.is_expense,
            Transaction.timestamp >= t_min_10m,
            Transaction.timestamp <= t_max_10m,
        )
        if resolved_account_id is not None:
            stmt_fb = stmt_fb.where(Transaction.account_id == resolved_account_id)

        res_fb = await session.execute(stmt_fb)
        return res_fb.scalars().first()

    @classmethod
    async def process_draft(
        cls,
        session: AsyncSession,
        draft: DraftTransaction,
        fallback_account_id: int | None = None,
    ) -> tuple[Transaction, bool]:
        account = await AccountResolver.resolve(session, draft)
        resolved_account_id = account.id if account else fallback_account_id

        existing = await cls.find_matching_transaction(session, draft, resolved_account_id)

        if existing:
            # Non-destructive enrichment merge
            if account and existing.account_id != account.id:
                # Rebalance if account resolution upgraded to verified account
                old_account = await session.get(Account, existing.account_id)
                if old_account:
                    if existing.is_expense:
                        old_account.balance += existing.amount
                        account.balance -= existing.amount
                    else:
                        old_account.balance -= existing.amount
                        account.balance += existing.amount
                    existing.account_id = account.id

            if draft.reference_number and not existing.reference_number:
                existing.reference_number = draft.reference_number

            if draft.merchant_vpa and not existing.merchant_vpa:
                existing.merchant_vpa = draft.merchant_vpa

            if draft.merchant_name and (
                existing.merchant_name == "Unknown Merchant"
                or len(draft.merchant_name) > len(existing.merchant_name)
            ):
                existing.merchant_name = draft.merchant_name

            raw_msg = await session.get(RawMessage, draft.raw_message_id)
            if raw_msg:
                raw_msg.status = "MERGED"

            await session.commit()
            await session.refresh(existing)
            return (existing, False)

        if resolved_account_id is None:
            raise ValueError(
                f"Could not resolve account for draft {draft.account_institution} "
                f"last4={draft.account_number_last4} and no fallback_account_id provided"
            )

        timestamp = draft.raw_timestamp or datetime.now(UTC)
        tx = await LedgerService.record_transaction(
            session=session,
            account_id=resolved_account_id,
            amount=draft.amount,
            merchant_name=draft.merchant_name,
            timestamp=timestamp,
            is_expense=draft.is_expense,
            is_transfer=draft.is_transfer,
            raw_message_id=draft.raw_message_id,
            merchant_vpa=draft.merchant_vpa,
            reference_number=draft.reference_number,
            description=draft.description,
            status="POSTED",
        )

        raw_msg = await session.get(RawMessage, draft.raw_message_id)
        if raw_msg:
            raw_msg.status = "PARSED"
            await session.commit()

        return (tx, True)

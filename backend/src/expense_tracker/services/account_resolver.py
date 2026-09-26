from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.models.account import Account
from expense_tracker.parsers.base import DraftTransaction

class AccountResolver:
    @staticmethod
    async def resolve(session: AsyncSession, draft: DraftTransaction) -> Optional[Account]:
        """Resolves an active Account matching last4 digits and institution."""
        if not draft.account_number_last4:
            return None

        stmt = select(Account).where(
            Account.account_number_last4 == draft.account_number_last4,
            Account.is_active == True,  # noqa: E712
        )
        if draft.account_institution and draft.account_institution != "GENERIC":
            stmt = stmt.where(Account.institution == draft.account_institution)

        res = await session.execute(stmt)
        return res.scalar_one_or_none()

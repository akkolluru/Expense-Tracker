from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.api.deps import get_db, verify_api_key
from expense_tracker.api.schemas import AccountCreate, AccountResponse
from expense_tracker.models.account import Account
from expense_tracker.services.ledger import LedgerService

router = APIRouter(prefix="/accounts", tags=["Accounts"], dependencies=[Depends(verify_api_key)])


@router.get("", response_model=list[AccountResponse])
async def list_accounts(session: AsyncSession = Depends(get_db)) -> list[Account]:
    stmt = select(Account).where(Account.is_active == True)
    res = await session.execute(stmt)
    return list(res.scalars().all())


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: AccountCreate, session: AsyncSession = Depends(get_db)
) -> Account:
    return await LedgerService.create_account(
        session=session,
        name=payload.name,
        institution=payload.institution,
        account_type=payload.account_type,
        currency=payload.currency,
        initial_balance=payload.initial_balance,
        account_number_last4=payload.account_number_last4,
    )

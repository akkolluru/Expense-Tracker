from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.api.deps import get_db, verify_api_key
from expense_tracker.api.schemas import (
    SplitResponse,
    SplitTransactionRequest,
    TransactionCreate,
    TransactionListResponse,
    TransactionResponse,
)
from expense_tracker.models.transaction import Transaction
from expense_tracker.services.ledger import LedgerService, SplitItem, SplitMismatchError

router = APIRouter(
    prefix="/transactions", tags=["Transactions"], dependencies=[Depends(verify_api_key)]
)


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    account_id: int | None = None,
    category_id: int | None = None,
    status_filter: str | None = Query(None, alias="status"),
    session: AsyncSession = Depends(get_db),
) -> TransactionListResponse:
    stmt = select(Transaction)
    if account_id:
        stmt = stmt.where(Transaction.account_id == account_id)
    if category_id:
        stmt = stmt.where(Transaction.category_id == category_id)
    if status_filter:
        stmt = stmt.where(Transaction.status == status_filter)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_res = await session.execute(count_stmt)
    total = total_res.scalar() or 0

    stmt = (
        stmt.order_by(Transaction.timestamp.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    res = await session.execute(stmt)
    items = list(res.scalars().all())

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    return TransactionListResponse(
        items=[TransactionResponse.model_validate(tx) for tx in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    payload: TransactionCreate,
    response: Response,
    x_idempotency_key: str | None = Header(None, alias="X-Idempotency-Key"),
    session: AsyncSession = Depends(get_db),
) -> Transaction:
    idemp_key = payload.idempotency_key or x_idempotency_key

    # Idempotency check
    if idemp_key:
        stmt = select(Transaction).where(Transaction.idempotency_key == idemp_key)
        res = await session.execute(stmt)
        existing = res.scalar_one_or_none()
        if existing:
            response.status_code = status.HTTP_200_OK
            return existing

    try:
        return await LedgerService.record_transaction(
            session=session,
            account_id=payload.account_id,
            destination_account_id=payload.destination_account_id,
            category_id=payload.category_id,
            group_id=payload.group_id,
            amount=payload.amount,
            currency=payload.currency,
            is_expense=payload.is_expense,
            is_transfer=payload.is_transfer,
            idempotency_key=idemp_key,
            merchant_name=payload.merchant_name,
            description=payload.description,
            timestamp=payload.timestamp,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{tx_id}/split", response_model=list[SplitResponse])
async def split_transaction(
    tx_id: int, payload: SplitTransactionRequest, session: AsyncSession = Depends(get_db)
) -> list[SplitResponse]:
    split_items = [
        SplitItem(category_id=s.category_id, amount=s.amount, note=s.note) for s in payload.splits
    ]
    try:
        splits = await LedgerService.split_transaction(session, tx_id, split_items)
        return [SplitResponse.model_validate(s) for s in splits]
    except SplitMismatchError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

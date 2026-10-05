from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.api.deps import get_db, verify_api_key
from expense_tracker.api.schemas import (
    InboxApproveRequest,
    InboxItemResponse,
    SuggestedCategoryDTO,
    TransactionResponse,
)
from expense_tracker.models.category import Category
from expense_tracker.models.transaction import Transaction
from expense_tracker.services.merchant_memory import MerchantMemoryService

router = APIRouter(prefix="/inbox", tags=["Inbox"], dependencies=[Depends(verify_api_key)])


@router.get("", response_model=list[InboxItemResponse])
async def list_inbox_items(session: AsyncSession = Depends(get_db)) -> list[InboxItemResponse]:
    stmt = (
        select(Transaction)
        .where(Transaction.status == "PENDING_REVIEW")
        .order_by(Transaction.timestamp.desc())
    )
    res = await session.execute(stmt)
    txs = res.scalars().all()

    inbox_items: list[InboxItemResponse] = []
    for tx in txs:
        suggested: SuggestedCategoryDTO | None = None
        if tx.suggested_category_id:
            cat = await session.get(Category, tx.suggested_category_id)
            if cat:
                suggested = SuggestedCategoryDTO(
                    id=cat.id, name=cat.name, parent_category=cat.parent_category
                )

        inbox_items.append(
            InboxItemResponse(
                id=tx.id,
                amount=tx.amount,
                merchant_name=tx.merchant_name,
                merchant_vpa=tx.merchant_vpa,
                timestamp=tx.timestamp,
                suggested_category=suggested,
                confidence=tx.categorization_confidence,
                reasoning=tx.description,
            )
        )
    return inbox_items


@router.post("/{tx_id}/approve", response_model=TransactionResponse)
async def approve_inbox_item(
    tx_id: int, payload: InboxApproveRequest, session: AsyncSession = Depends(get_db)
) -> Transaction:
    tx = await session.get(Transaction, tx_id)
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    category = await session.get(Category, payload.category_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category_id")

    tx.category_id = payload.category_id
    tx.suggested_category_id = None
    tx.status = "POSTED"

    if payload.never_auto_classify:
        await MerchantMemoryService.learn_merchant(
            session=session,
            category_id=payload.category_id,
            merchant_name=tx.merchant_name,
            merchant_vpa=tx.merchant_vpa,
            never_auto_classify=True,
        )
    elif payload.learn_merchant:
        await MerchantMemoryService.learn_merchant(
            session=session,
            category_id=payload.category_id,
            merchant_name=tx.merchant_name,
            merchant_vpa=tx.merchant_vpa,
            never_auto_classify=False,
        )

    await session.commit()
    await session.refresh(tx)
    return tx

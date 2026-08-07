
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import NotFoundError
from app.models.categorization_log import CategorizationLog
from app.models.rule import Rule
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.pagination import PaginatedResponse
from app.schemas.transaction import TransactionResponse

router = APIRouter()

class CategorizeRequest(BaseModel):
    category_id: int
    sub_category_id: int | None = None
    create_rule: bool = False

@router.get("/pending", response_model=PaginatedResponse[TransactionResponse])
async def list_pending_transactions(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    query = select(Transaction).where(Transaction.status == "pending_review")
    
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()
    
    query = query.order_by(desc(Transaction.timestamp)).offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    items = result.scalars().all()
    
    pages = (total + size - 1) // size
    
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages
    )

@router.get("/count")
async def get_pending_count(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    query = select(func.count(Transaction.id)).where(Transaction.status == "pending_review")
    result = await db.execute(query)
    count = result.scalar_one()
    return {"count": count}

@router.post("/categorize/{txn_id}", response_model=TransactionResponse)
async def categorize_transaction(
    txn_id: str,
    categorize_in: CategorizeRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    # Fetch transaction
    result = await db.execute(select(Transaction).where(Transaction.id == txn_id))
    txn = result.scalar_one_or_none()
    if not txn:
        raise NotFoundError("Transaction", txn_id)
    
    # Determine log action based on current state
    is_recategorize = txn.status == "categorized"
    action = "user_recategorize" if is_recategorize else "user_categorize"
    
    # Save old category for recategorize logging
    old_category_id = txn.category_id
    old_sub_category_id = txn.sub_category_id
    
    # If recategorizing, mark as misclassified
    if is_recategorize:
        txn.is_misclassified = True

    # Update transaction
    txn.category_id = categorize_in.category_id
    txn.sub_category_id = categorize_in.sub_category_id
    txn.status = "categorized"
    txn.categorized_by = "user"
    
    # Create rule if requested and VPA exists
    if categorize_in.create_rule and txn.vpa:
        rule_result = await db.execute(select(Rule).where(Rule.vpa == txn.vpa))
        rule = rule_result.scalar_one_or_none()
        if rule:
            rule.category_id = categorize_in.category_id
            rule.sub_category_id = categorize_in.sub_category_id
            rule.merchant_name = txn.merchant_name
        else:
            new_rule = Rule(
                vpa=txn.vpa,
                merchant_name=txn.merchant_name,
                category_id=categorize_in.category_id,
                sub_category_id=categorize_in.sub_category_id,
                hit_count=0
            )
            db.add(new_rule)
    
    # Write categorization log entry
    log = CategorizationLog(
        transaction_id=txn.id,
        action=action,
        from_category_id=old_category_id if is_recategorize else None,
        from_sub_category_id=old_sub_category_id if is_recategorize else None,
        to_category_id=categorize_in.category_id,
        to_sub_category_id=categorize_in.sub_category_id,
    )
    db.add(log)

    await db.commit()
    await db.refresh(txn)
    
    return txn


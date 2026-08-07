import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User

router = APIRouter()

@router.get("/spending-summary")
async def get_spending_summary(
    range: str = "1M",
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get aggregated spending data for the donut chart based on the time range.
    Supported ranges: 1W, 1M, 3M, 1Y, ALL
    """
    now = datetime.datetime.now()
    if range == "1W":
        start_date = now - datetime.timedelta(days=7)
    elif range == "1M":
        start_date = now - datetime.timedelta(days=30)
    elif range == "3M":
        start_date = now - datetime.timedelta(days=90)
    elif range == "1Y":
        start_date = now - datetime.timedelta(days=365)
    else:
        start_date = datetime.datetime.min
        
    # Aggregate debits by category
    stmt = (
        select(Transaction.category_id, Category.name.label("category_name"), func.sum(Transaction.amount).label("total_amount"))
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.timestamp >= start_date,
            Transaction.direction == "debit",
            Transaction.status == "categorized"
        )
        .group_by(Transaction.category_id, Category.name)
    )
    result = await db.execute(stmt)
    debit_results = result.all()
    
    # Calculate overall totals
    total_debit_stmt = select(func.sum(Transaction.amount)).where(
        Transaction.timestamp >= start_date,
        Transaction.direction == "debit",
        Transaction.status == "categorized"
    )
    total_debit_result = await db.execute(total_debit_stmt)
    total_debit = total_debit_result.scalar() or 0.0
    
    total_credit_stmt = select(func.sum(Transaction.amount)).where(
        Transaction.timestamp >= start_date,
        Transaction.direction == "credit",
        Transaction.status == "categorized"
    )
    total_credit_result = await db.execute(total_credit_stmt)
    total_credit = total_credit_result.scalar() or 0.0

    category_breakdown = []
    for r in debit_results:
        category_breakdown.append({
            "category_id": r.category_id,
            "category_name": r.category_name or "Unknown",
            "amount": r.total_amount
        })
        
    return {
        "range": range,
        "start_date": start_date.isoformat(),
        "total_debit": total_debit,
        "total_credit": total_credit,
        "breakdown": category_breakdown
    }

@router.get("/categorization-stats")
async def get_categorization_stats(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Return metrics on how transactions are being categorized (Rule Engine vs LLM vs User).
    """
    stmt = (
        select(Transaction.categorized_by, func.count(Transaction.id).label("count"))
        .where(
            Transaction.categorized_by.isnot(None),
            Transaction.categorized_by != "pending",
        )
        .group_by(Transaction.categorized_by)
    )
    result = await db.execute(stmt)
    stats = result.all()
    
    total = sum([s.count for s in stats])
    
    response_stats = []
    for s in stats:
        response_stats.append({
            "source": s.categorized_by,
            "count": s.count,
            "percentage": (s.count / total * 100) if total > 0 else 0
        })
        
    return {
        "total_categorized": total,
        "stats": response_stats
    }

@router.get("/misclassified")
async def get_misclassified(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    limit: int = 50,
):
    """
    Get transactions still needing review.
    """
    stmt = (
        select(Transaction)
        .where(Transaction.status == "pending_review")
        .order_by(Transaction.timestamp.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    txns = result.scalars().all()
    
    items = []
    for t in txns:
        items.append({
            "id": t.id,
            "amount": t.amount,
            "direction": t.direction,
            "timestamp": t.timestamp.isoformat() if t.timestamp else None,
            "vpa": t.vpa,
            "merchant_name": t.merchant_name,
            "category_id": t.category_id,
            "status": t.status,
        })
    
    return {"items": items}

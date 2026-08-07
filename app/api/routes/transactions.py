
from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import DuplicateError, NotFoundError
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.pagination import PaginatedResponse
from app.schemas.transaction import (
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
)

router = APIRouter()

@router.get("/", response_model=PaginatedResponse[TransactionResponse])
async def list_transactions(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: str | None = None,
    category_id: int | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    query = select(Transaction)
    
    if search:
        query = query.where(
            Transaction.merchant_name.ilike(f"%{search}%") | 
            Transaction.description.ilike(f"%{search}%") |
            Transaction.vpa.ilike(f"%{search}%")
        )
        
    if category_id:
        query = query.where(
            (Transaction.category_id == category_id) | 
            (Transaction.sub_category_id == category_id)
        )
        
    if status:
        query = query.where(Transaction.status == status)
        
    # Count total
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()
    
    # Fetch paginated
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

@router.post("/", response_model=TransactionResponse)
async def create_transaction(
    txn_in: TransactionCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    if txn_in.txn_ref:
        result = await db.execute(select(Transaction).where(Transaction.txn_ref == txn_in.txn_ref))
        if result.scalar_one_or_none():
            raise DuplicateError("Transaction", "txn_ref", txn_in.txn_ref)
            
    txn = Transaction(**txn_in.model_dump())
    db.add(txn)
    await db.commit()
    await db.refresh(txn)
    return txn

@router.get("/{txn_id}", response_model=TransactionResponse)
async def get_transaction(
    txn_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Transaction).where(Transaction.id == txn_id))
    txn = result.scalar_one_or_none()
    if not txn:
        raise NotFoundError("Transaction", txn_id)
    return txn

@router.put("/{txn_id}", response_model=TransactionResponse)
async def update_transaction(
    txn_id: str,
    txn_in: TransactionUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Transaction).where(Transaction.id == txn_id))
    txn = result.scalar_one_or_none()
    if not txn:
        raise NotFoundError("Transaction", txn_id)
        
    update_data = txn_in.model_dump(exclude_unset=True)
    if "txn_ref" in update_data and update_data["txn_ref"] != txn.txn_ref:
        check = await db.execute(select(Transaction).where(Transaction.txn_ref == update_data["txn_ref"]))
        if check.scalar_one_or_none():
            raise DuplicateError("Transaction", "txn_ref", update_data["txn_ref"])
            
    for field, value in update_data.items():
        setattr(txn, field, value)
        
    await db.commit()
    await db.refresh(txn)
    return txn

@router.delete("/{txn_id}")
async def delete_transaction(
    txn_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Transaction).where(Transaction.id == txn_id))
    txn = result.scalar_one_or_none()
    if not txn:
        raise NotFoundError("Transaction", txn_id)
        
    await db.delete(txn)
    await db.commit()
    return {"message": "Transaction deleted"}

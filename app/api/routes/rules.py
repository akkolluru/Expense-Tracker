from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional

from app.api.deps import get_db_session, get_current_user
from app.models.rule import Rule
from app.models.user import User
from app.schemas.rule import RuleCreate, RuleUpdate, RuleResponse
from app.schemas.pagination import PaginatedResponse
from app.core.exceptions import NotFoundError, DuplicateError

router = APIRouter()

@router.get("/", response_model=PaginatedResponse[RuleResponse])
async def list_rules(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    query = select(Rule)
    
    if search:
        query = query.where(
            Rule.vpa.ilike(f"%{search}%") | 
            Rule.merchant_name.ilike(f"%{search}%")
        )
        
    # Count total
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()
    
    # Fetch paginated
    query = query.order_by(Rule.hit_count.desc(), Rule.created_at.desc()).offset((page - 1) * size).limit(size)
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

@router.post("/", response_model=RuleResponse)
async def create_rule(
    rule_in: RuleCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Rule).where(Rule.vpa == rule_in.vpa))
    if result.scalar_one_or_none():
        raise DuplicateError("Rule", "vpa", rule_in.vpa)
        
    rule = Rule(**rule_in.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule

@router.put("/{rule_id}", response_model=RuleResponse)
async def update_rule(
    rule_id: int,
    rule_in: RuleUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise NotFoundError("Rule", rule_id)
        
    update_data = rule_in.model_dump(exclude_unset=True)
    if "vpa" in update_data and update_data["vpa"] != rule.vpa:
        check = await db.execute(select(Rule).where(Rule.vpa == update_data["vpa"]))
        if check.scalar_one_or_none():
            raise DuplicateError("Rule", "vpa", update_data["vpa"])
            
    for field, value in update_data.items():
        setattr(rule, field, value)
        
    await db.commit()
    await db.refresh(rule)
    return rule

@router.delete("/{rule_id}")
async def delete_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise NotFoundError("Rule", rule_id)
        
    await db.delete(rule)
    await db.commit()
    return {"message": "Rule deleted"}

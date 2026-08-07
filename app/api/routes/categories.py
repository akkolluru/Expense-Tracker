
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db_session
from app.core.exceptions import DuplicateError, NotFoundError
from app.models.category import Category
from app.models.user import User
from app.schemas.category import (
    CategoryCreate,
    CategoryResponse,
    CategoryTreeResponse,
    CategoryUpdate,
)

router = APIRouter()

@router.get("/", response_model=list[CategoryResponse])
async def list_categories(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Category).order_by(Category.name))
    return result.scalars().all()

@router.get("/tree", response_model=list[CategoryTreeResponse])
async def get_category_tree(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    # Fetch top-level categories and eagerly load their children
    result = await db.execute(
        select(Category)
        .where(Category.parent_id == None)
        .options(selectinload(Category.children))
        .order_by(Category.name)
    )
    categories = result.scalars().all()
    return categories

@router.post("/", response_model=CategoryResponse)
async def create_category(
    category_in: CategoryCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    # Check for duplicate
    stmt = select(Category).where(
        Category.name == category_in.name,
        Category.parent_id == category_in.parent_id
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise DuplicateError("Category", "name and parent_id", category_in.name)
        
    category = Category(**category_in.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category

@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    category_in: CategoryUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise NotFoundError("Category", category_id)
        
    update_data = category_in.model_dump(exclude_unset=True)
    
    # If name or parent_id changes, check for duplicate
    if "name" in update_data or "parent_id" in update_data:
        new_name = update_data.get("name", category.name)
        new_parent_id = update_data.get("parent_id", category.parent_id)
        stmt = select(Category).where(
            Category.name == new_name,
            Category.parent_id == new_parent_id,
            Category.id != category_id
        )
        if (await db.execute(stmt)).scalar_one_or_none():
             raise DuplicateError("Category", "name and parent_id", new_name)

    for field, value in update_data.items():
        setattr(category, field, value)
        
    await db.commit()
    await db.refresh(category)
    return category

@router.delete("/{category_id}")
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise NotFoundError("Category", category_id)
        
    await db.delete(category)
    await db.commit()
    return {"message": "Category deleted"}

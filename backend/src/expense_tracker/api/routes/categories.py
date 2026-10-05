from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.api.deps import get_db, verify_api_key
from expense_tracker.api.schemas import CategoryResponse
from expense_tracker.models.category import Category

router = APIRouter(
    prefix="/categories", tags=["Categories"], dependencies=[Depends(verify_api_key)]
)


@router.get("", response_model=list[CategoryResponse])
async def list_categories(session: AsyncSession = Depends(get_db)) -> list[Category]:
    stmt = select(Category).order_by(Category.name.asc())
    res = await session.execute(stmt)
    return list(res.scalars().all())

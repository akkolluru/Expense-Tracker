from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.api.deps import get_db, verify_api_key
from expense_tracker.services.analytics import AnalyticsService

router = APIRouter(
    prefix="/analytics", tags=["Analytics"], dependencies=[Depends(verify_api_key)]
)

class SummaryResponse(BaseModel):
    income: float
    burn_rate: float
    savings_rate: float

class CategoryBreakdownItem(BaseModel):
    category_id: int
    name: str
    icon: str
    color: str
    amount: float

class TopSpendItem(BaseModel):
    transaction_id: int
    merchant_name: str
    amount: float
    timestamp: datetime

class MomVarianceResponse(BaseModel):
    current_burn: float
    prev_burn: float
    variance_percentage: float


@router.get("/summary", response_model=SummaryResponse)
async def get_summary(
    start_date: datetime = Query(..., description="Start date in ISO format"),
    end_date: datetime = Query(..., description="End date in ISO format"),
    db: AsyncSession = Depends(get_db),
) -> SummaryResponse:
    result = await AnalyticsService.get_summary_metrics(db, start_date, end_date)
    return SummaryResponse(**result)


@router.get("/categories", response_model=list[CategoryBreakdownItem])
async def get_categories(
    start_date: datetime = Query(..., description="Start date in ISO format"),
    end_date: datetime = Query(..., description="End date in ISO format"),
    db: AsyncSession = Depends(get_db),
) -> list[CategoryBreakdownItem]:
    result = await AnalyticsService.get_category_breakdown(db, start_date, end_date)
    return [CategoryBreakdownItem(**item) for item in result]


@router.get("/categories/{category_id}/top-spends", response_model=list[TopSpendItem])
async def get_category_top_spends(
    category_id: int,
    start_date: datetime = Query(..., description="Start date in ISO format"),
    end_date: datetime = Query(..., description="End date in ISO format"),
    limit: int = Query(5, description="Number of items to return"),
    db: AsyncSession = Depends(get_db),
) -> list[TopSpendItem]:
    result = await AnalyticsService.get_top_spends(db, category_id, start_date, end_date, limit)
    return [TopSpendItem(**item) for item in result]


@router.get("/mom-variance", response_model=MomVarianceResponse)
async def get_mom_variance(
    current_month_start: datetime = Query(..., description="Start of current month in ISO format"),
    current_month_end: datetime = Query(..., description="End of current month in ISO format"),
    prev_month_start: datetime = Query(..., description="Start of previous month in ISO format"),
    prev_month_end: datetime = Query(..., description="End of previous month in ISO format"),
    db: AsyncSession = Depends(get_db),
) -> MomVarianceResponse:
    result = await AnalyticsService.get_mom_variance(
        db,
        current_month_start,
        current_month_end,
        prev_month_start,
        prev_month_end,
    )
    return MomVarianceResponse(**result)

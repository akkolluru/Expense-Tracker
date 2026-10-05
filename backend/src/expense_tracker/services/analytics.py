from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.models.category import Category
from expense_tracker.models.transaction import Transaction


class AnalyticsService:
    @classmethod
    async def get_summary_metrics(
        cls, session: AsyncSession, start_date: datetime, end_date: datetime
    ) -> dict[str, Any]:
        income_stmt = select(func.coalesce(func.sum(Transaction.amount), Decimal(0))).where(
            Transaction.timestamp >= start_date,
            Transaction.timestamp <= end_date,
            Transaction.is_expense == False,
            Transaction.is_transfer == False,
        )
        expense_stmt = select(func.coalesce(func.sum(Transaction.amount), Decimal(0))).where(
            Transaction.timestamp >= start_date,
            Transaction.timestamp <= end_date,
            Transaction.is_expense == True,
            Transaction.is_transfer == False,
        )

        income = (await session.execute(income_stmt)).scalar_one()
        burn_rate = (await session.execute(expense_stmt)).scalar_one()

        savings_rate = Decimal(0)
        if income > 0:
            savings_rate = ((income - burn_rate) / income) * 100

        return {
            "income": float(income),
            "burn_rate": float(burn_rate),
            "savings_rate": float(savings_rate),
        }

    @classmethod
    async def get_category_breakdown(
        cls, session: AsyncSession, start_date: datetime, end_date: datetime
    ) -> list[dict[str, Any]]:
        stmt = (
            select(
                Category.id,
                Category.name,
                Category.icon,
                Category.color,
                func.coalesce(func.sum(Transaction.amount), Decimal(0)).label("total_amount"),
            )
            .select_from(Transaction)
            .join(Category, Transaction.category_id == Category.id)
            .where(
                Transaction.timestamp >= start_date,
                Transaction.timestamp <= end_date,
                Transaction.is_expense == True,
                Transaction.is_transfer == False,
            )
            .group_by(Category.id, Category.name, Category.icon, Category.color)
            .order_by(func.sum(Transaction.amount).desc())
        )

        result = await session.execute(stmt)
        rows = result.all()

        return [
            {
                "category_id": row.id,
                "name": row.name,
                "icon": row.icon,
                "color": row.color,
                "amount": float(row.total_amount),
            }
            for row in rows
        ]

    @classmethod
    async def get_top_spends(
        cls,
        session: AsyncSession,
        category_id: int,
        start_date: datetime,
        end_date: datetime,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        stmt = (
            select(
                Transaction.id,
                Transaction.merchant_name,
                Transaction.amount,
                Transaction.timestamp,
            )
            .where(
                Transaction.category_id == category_id,
                Transaction.timestamp >= start_date,
                Transaction.timestamp <= end_date,
                Transaction.is_expense == True,
                Transaction.is_transfer == False,
            )
            .order_by(Transaction.amount.desc())
            .limit(limit)
        )

        result = await session.execute(stmt)
        rows = result.all()

        return [
            {
                "transaction_id": row.id,
                "merchant_name": row.merchant_name,
                "amount": float(row.amount),
                "timestamp": row.timestamp,
            }
            for row in rows
        ]

    @classmethod
    async def get_mom_variance(
        cls,
        session: AsyncSession,
        current_month_start: datetime,
        current_month_end: datetime,
        prev_month_start: datetime,
        prev_month_end: datetime,
    ) -> dict[str, Any]:
        curr_stmt = select(func.coalesce(func.sum(Transaction.amount), Decimal(0))).where(
            Transaction.timestamp >= current_month_start,
            Transaction.timestamp <= current_month_end,
            Transaction.is_expense == True,
            Transaction.is_transfer == False,
        )
        prev_stmt = select(func.coalesce(func.sum(Transaction.amount), Decimal(0))).where(
            Transaction.timestamp >= prev_month_start,
            Transaction.timestamp <= prev_month_end,
            Transaction.is_expense == True,
            Transaction.is_transfer == False,
        )

        current_burn = (await session.execute(curr_stmt)).scalar_one()
        prev_burn = (await session.execute(prev_stmt)).scalar_one()

        variance_percentage = Decimal(0)
        if prev_burn > 0:
            variance_percentage = ((current_burn - prev_burn) / prev_burn) * 100

        return {
            "current_burn": float(current_burn),
            "prev_burn": float(prev_burn),
            "variance_percentage": float(variance_percentage),
        }

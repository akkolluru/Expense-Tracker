import datetime

from sqlalchemy import DateTime, Float, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MonthlyReport(Base):
    __tablename__ = "monthly_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    total_spent: Mapped[float] = mapped_column(Float, default=0)
    total_income: Mapped[float] = mapped_column(Float, default=0)
    prev_month_spent: Mapped[float | None] = mapped_column(Float, nullable=True)
    prev_month_income: Mapped[float | None] = mapped_column(Float, nullable=True)
    spending_change_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    category_breakdown: Mapped[str | None] = mapped_column(String, nullable=True)
    weekly_trend: Mapped[str | None] = mapped_column(String, nullable=True)
    generated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("year", "month", name="uq_monthly_report_year_month"),
    )

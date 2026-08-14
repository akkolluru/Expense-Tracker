"""Group model representing event-based or trip-based transaction collections."""

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        doc="Start of event/trip window for auto-assignment",
    )
    end_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        doc="End of event/trip window for auto-assignment",
    )
    budget: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        doc="Target budget limit for this group/event",
    )
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

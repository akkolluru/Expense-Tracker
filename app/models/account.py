"""Account model representing financial accounts and institutions."""

import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Float, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AccountType(str, Enum):
    SAVINGS = "SAVINGS"
    CREDIT_CARD = "CREDIT_CARD"
    CASH = "CASH"
    INVESTMENT = "INVESTMENT"
    LOAN = "LOAN"


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    institution: Mapped[str] = mapped_column(String(100), nullable=False)
    account_type: Mapped[str] = mapped_column(
        String(50),
        default=AccountType.SAVINGS.value,
        nullable=False,
    )
    account_identifier: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        doc="e.g. last 4 digits of card/account or custom identifier",
    )
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    current_balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_ignored: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="If True, incoming messages for this account are suppressed without generating drafts",
    )
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

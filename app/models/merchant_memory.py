"""MerchantMemory model representing learned mappings from merchants/VPAs to categories."""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.category import Category


class MerchantKeyType(str, Enum):
    VPA = "VPA"
    MERCHANT_NAME = "MERCHANT_NAME"


class MerchantMemory(Base):
    __tablename__ = "merchant_memory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    merchant_key: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
        doc="Normalized VPA (lowercase) or Merchant Name (stripped uppercase)",
    )
    key_type: Mapped[str] = mapped_column(
        String(50),
        default=MerchantKeyType.VPA.value,
        nullable=False,
    )
    category_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("categories.id"),
        nullable=False,
    )
    sub_category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categories.id"),
        nullable=True,
    )
    hit_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    last_used_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
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

    category: Mapped["Category"] = relationship(
        "Category", foreign_keys=[category_id]
    )
    sub_category: Mapped[Optional["Category"]] = relationship(
        "Category", foreign_keys=[sub_category_id]
    )

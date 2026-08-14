"""CategorizationLog model for tracking audit history of categorization decisions."""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.transaction import Transaction


class CategorizationAction(str, Enum):
    AUTO_RULE = "AUTO_RULE"
    MERCHANT_MEMORY = "MERCHANT_MEMORY"
    AUTO_LLM = "AUTO_LLM"
    MANUAL_APPROVE = "MANUAL_APPROVE"
    MANUAL_RECATEGORIZE = "MANUAL_RECATEGORIZE"
    MANUAL_SPLIT = "MANUAL_SPLIT"


class CategorizationLog(Base):
    __tablename__ = "categorization_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transaction_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action: Mapped[str] = mapped_column(
        String(50),
        default=CategorizationAction.AUTO_RULE.value,
        nullable=False,
        doc="e.g. AUTO_RULE, MERCHANT_MEMORY, AUTO_LLM, MANUAL_APPROVE, MANUAL_RECATEGORIZE, MANUAL_SPLIT",
    )
    from_category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categories.id"),
        nullable=True,
    )
    from_sub_category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categories.id"),
        nullable=True,
    )
    to_category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categories.id"),
        nullable=True,
    )
    to_sub_category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categories.id"),
        nullable=True,
    )
    strategy: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        doc="RULE, MERCHANT_MEMORY, LLM, MANUAL",
    )
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    llm_response_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_inference_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )

    transaction: Mapped["Transaction"] = relationship(
        "Transaction", back_populates="categorization_logs"
    )
    from_category: Mapped[Optional["Category"]] = relationship(
        "Category", foreign_keys=[from_category_id]
    )
    from_sub_category: Mapped[Optional["Category"]] = relationship(
        "Category", foreign_keys=[from_sub_category_id]
    )
    to_category: Mapped[Optional["Category"]] = relationship(
        "Category", foreign_keys=[to_category_id]
    )
    to_sub_category: Mapped[Optional["Category"]] = relationship(
        "Category", foreign_keys=[to_sub_category_id]
    )

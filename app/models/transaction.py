"""Transaction model representing financial movements (Expense, Income, Transfer)."""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.account import Account
    from app.models.categorization_log import CategorizationLog
    from app.models.category import Category
    from app.models.group import Group
    from app.models.raw_message import RawMessage
    from app.models.split import Split


class TransactionType(str, Enum):
    EXPENSE = "EXPENSE"
    INCOME = "INCOME"
    TRANSFER = "TRANSFER"


class TransactionStatus(str, Enum):
    COMMITTED = "COMMITTED"
    PENDING_REVIEW = "PENDING_REVIEW"
    RECONCILED = "RECONCILED"
    EXCLUDED = "EXCLUDED"


class CategorizationStrategy(str, Enum):
    RULE = "RULE"
    MERCHANT_MEMORY = "MERCHANT_MEMORY"
    LLM = "LLM"
    MANUAL = "MANUAL"


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    source_account_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("accounts.id"),
        nullable=True,
        index=True,
        doc="Source account debited or originating fund bucket",
    )
    destination_account_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("accounts.id"),
        nullable=True,
        index=True,
        doc="Destination account credited (for transfers and direct inflows)",
    )
    raw_message_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("raw_messages.id"),
        nullable=True,
        index=True,
        doc="Original immutable incoming notification if ingested from external source",
    )
    transaction_type: Mapped[str] = mapped_column(
        String(50),
        default=TransactionType.EXPENSE.value,
        nullable=False,
        index=True,
    )
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        index=True,
    )
    vpa: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
        doc="Normalized lowercase UPI VPA (e.g. merchant@icici)",
    )
    merchant_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="Clean normalized merchant name",
    )
    raw_merchant_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        doc="Raw payee/merchant text extracted from bank notification",
    )
    category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categories.id"),
        nullable=True,
        index=True,
        doc="Main category ID (NULL when is_split is True)",
    )
    sub_category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categories.id"),
        nullable=True,
        doc="Subcategory ID (NULL when is_split is True)",
    )
    is_split: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="If True, line-item breakdown is stored in splits table",
    )
    group_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("groups.id"),
        nullable=True,
        index=True,
        doc="Optional event/trip group association",
    )
    is_group_locked: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="If True, group assignment is locked against automatic date-window re-assignment",
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default=TransactionStatus.PENDING_REVIEW.value,
        nullable=False,
        index=True,
    )
    categorized_by: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        doc="Strategy used to assign category (RULE, MERCHANT_MEMORY, LLM, MANUAL)",
    )
    txn_ref: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
        doc="Bank UTR or transaction reference number for deduplication",
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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

    source_account: Mapped[Optional["Account"]] = relationship(
        "Account", foreign_keys=[source_account_id]
    )
    destination_account: Mapped[Optional["Account"]] = relationship(
        "Account", foreign_keys=[destination_account_id]
    )
    raw_message: Mapped[Optional["RawMessage"]] = relationship(
        "RawMessage", foreign_keys=[raw_message_id]
    )
    category: Mapped[Optional["Category"]] = relationship(
        "Category", foreign_keys=[category_id]
    )
    sub_category: Mapped[Optional["Category"]] = relationship(
        "Category", foreign_keys=[sub_category_id]
    )
    group: Mapped[Optional["Group"]] = relationship(
        "Group", foreign_keys=[group_id]
    )
    splits: Mapped[list["Split"]] = relationship(
        "Split", back_populates="transaction", cascade="all, delete-orphan"
    )
    categorization_logs: Mapped[list["CategorizationLog"]] = relationship(
        "CategorizationLog",
        back_populates="transaction",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_transactions_timestamp_desc", timestamp.desc()),
    )

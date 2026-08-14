"""Rule model for deterministic transaction categorization and transfer routing."""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.account import Account
    from app.models.category import Category
    from app.models.group import Group


class RuleType(str, Enum):
    VPA = "VPA"
    MERCHANT_NAME = "MERCHANT_NAME"
    REGEX = "REGEX"
    KEYWORD = "KEYWORD"


class Rule(Base):
    __tablename__ = "rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rule_type: Mapped[str] = mapped_column(
        String(50),
        default=RuleType.VPA.value,
        nullable=False,
    )
    pattern: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Matching pattern: VPA exact string, merchant substring/exact, regex, or keyword",
    )
    target_category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categories.id"),
        nullable=True,
    )
    target_sub_category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categories.id"),
        nullable=True,
    )
    target_group_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("groups.id"),
        nullable=True,
    )
    is_transfer: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="If True, matches identify intra-account transfers to transfer_dest_account_id",
    )
    transfer_dest_account_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("accounts.id"),
        nullable=True,
    )
    priority: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Higher number = higher precedence during rule matching",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    hit_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
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

    target_category: Mapped[Optional["Category"]] = relationship(
        "Category", foreign_keys=[target_category_id]
    )
    target_sub_category: Mapped[Optional["Category"]] = relationship(
        "Category", foreign_keys=[target_sub_category_id]
    )
    target_group: Mapped[Optional["Group"]] = relationship(
        "Group", foreign_keys=[target_group_id]
    )
    transfer_dest_account: Mapped[Optional["Account"]] = relationship(
        "Account", foreign_keys=[transfer_dest_account_id]
    )

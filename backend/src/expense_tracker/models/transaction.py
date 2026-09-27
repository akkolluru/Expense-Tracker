from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from expense_tracker.models.base import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False
    )
    destination_account_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=True
    )
    raw_message_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("raw_messages.id", ondelete="SET NULL"), nullable=True
    )
    category_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=True
    )
    suggested_category_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    group_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("groups.id", ondelete="SET NULL"), nullable=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    is_expense: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_transfer: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_settlement: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    idempotency_key: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="POSTED", nullable=False)
    merchant_name: Mapped[str] = mapped_column(String(255), nullable=False)
    merchant_vpa: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    categorization_strategy: Mapped[str] = mapped_column(
        String(30), default="MANUAL", nullable=False
    )
    categorization_confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    splits: Mapped[list["Split"]] = relationship(
        "Split", back_populates="transaction", cascade="all, delete-orphan"
    )
    peer_splits: Mapped[list["PeerSplit"]] = relationship(
        "PeerSplit",
        foreign_keys="[PeerSplit.transaction_id]",
        back_populates="transaction",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index(
            "idx_transactions_analytics",
            "timestamp",
            "category_id",
            "is_expense",
            "is_transfer",
            "group_id",
            "account_id",
        ),
        Index(
            "idx_transactions_inbox",
            "status",
            "timestamp",
            sqlite_where=(status == "PENDING_REVIEW"),
        ),
        Index(
            "idx_transactions_group", "group_id", "timestamp", sqlite_where=(group_id.isnot(None))
        ),
        Index(
            "idx_transactions_utr", "reference_number", sqlite_where=(reference_number.isnot(None))
        ),
        Index(
            "idx_transactions_idempotency",
            "idempotency_key",
            sqlite_where=(idempotency_key.isnot(None)),
        ),
    )


class Split(Base):
    __tablename__ = "splits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transaction_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False
    )
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    transaction: Mapped["Transaction"] = relationship("Transaction", back_populates="splits")

    __table_args__ = (Index("idx_splits_tx", "transaction_id"),)


class PeerSplit(Base):
    __tablename__ = "peer_splits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transaction_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False
    )
    settlement_transaction_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True
    )
    member_name: Mapped[str] = mapped_column(String(100), nullable=False)
    upi_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    share_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    transaction: Mapped["Transaction"] = relationship(
        "Transaction", foreign_keys=[transaction_id], back_populates="peer_splits"
    )

    __table_args__ = (
        Index("idx_peer_splits_tx", "transaction_id", "is_paid"),
        Index("idx_peer_splits_settlement", "settlement_transaction_id"),
    )

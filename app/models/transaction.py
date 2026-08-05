import datetime
import uuid
from typing import Optional, List
from sqlalchemy import String, Integer, Float, Boolean, DateTime, ForeignKey, CheckConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Transaction(Base):
    __tablename__ = "transactions"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    amount: Mapped[float] = mapped_column(Float, CheckConstraint("amount > 0", name="chk_txn_amount"), nullable=False)
    direction: Mapped[str] = mapped_column(String, CheckConstraint("direction IN ('debit', 'credit')", name="chk_txn_direction"), nullable=False)
    currency: Mapped[str] = mapped_column(String, default='INR')
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    vpa: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    merchant_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    raw_merchant_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    category_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("categories.id"), nullable=True)
    sub_category_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("categories.id"), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    txn_ref: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True)
    txn_type: Mapped[str] = mapped_column(String, CheckConstraint("txn_type IN ('upi', 'neft', 'imps', 'card', 'atm', 'manual')", name="chk_txn_type"), nullable=False)
    account_last4: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, CheckConstraint("status IN ('categorized', 'pending_review')", name="chk_txn_status"), default='pending_review', nullable=False)
    categorized_by: Mapped[Optional[str]] = mapped_column(String, CheckConstraint("categorized_by IN ('rule_engine', 'llm', 'user')", name="chk_txn_categorized_by"), nullable=True)
    source: Mapped[str] = mapped_column(String, CheckConstraint("source IN ('email_auto', 'manual')", name="chk_txn_source"), nullable=False)
    email_message_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_misclassified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    category: Mapped[Optional["Category"]] = relationship("Category", foreign_keys=[category_id])
    sub_category: Mapped[Optional["Category"]] = relationship("Category", foreign_keys=[sub_category_id])
    categorization_logs: Mapped[List["CategorizationLog"]] = relationship("CategorizationLog", back_populates="transaction")

    __table_args__ = (
        Index("ix_transactions_timestamp_desc", timestamp.desc()),
        Index("ix_transactions_status", status),
        Index("ix_transactions_category_id", category_id),
        Index("ix_transactions_direction", direction),
        Index("ix_transactions_txn_type", txn_type),
        Index("ix_transactions_vpa", vpa),
        Index("ix_transactions_email_message_id", email_message_id),
    )

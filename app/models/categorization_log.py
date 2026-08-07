import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CategorizationLog(Base):
    __tablename__ = "categorization_logs"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transaction_id: Mapped[str] = mapped_column(String, ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False)
    action: Mapped[str] = mapped_column(String, CheckConstraint("action IN ('auto_rule', 'auto_llm', 'user_categorize', 'user_recategorize')", name="chk_cat_log_action"), nullable=False)
    from_category_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("categories.id"), nullable=True)
    from_sub_category_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("categories.id"), nullable=True)
    to_category_id: Mapped[int] = mapped_column(Integer, ForeignKey("categories.id"), nullable=False)
    to_sub_category_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("categories.id"), nullable=True)
    llm_response_raw: Mapped[str | None] = mapped_column(String, nullable=True)
    llm_inference_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    
    transaction: Mapped["Transaction"] = relationship("Transaction", back_populates="categorization_logs")

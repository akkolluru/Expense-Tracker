import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional
from app.database import Base

class Rule(Base):
    __tablename__ = "rules"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vpa: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    merchant_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    category_id: Mapped[int] = mapped_column(Integer, ForeignKey("categories.id"), nullable=False)
    sub_category_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("categories.id"), nullable=True)
    hit_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    
    category: Mapped["Category"] = relationship("Category", foreign_keys=[category_id])
    sub_category: Mapped[Optional["Category"]] = relationship("Category", foreign_keys=[sub_category_id])

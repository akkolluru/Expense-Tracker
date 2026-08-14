import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class EmailSyncState(Base):
    __tablename__ = "email_sync_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    last_history_id: Mapped[str | None] = mapped_column(String, nullable=True)
    last_poll_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    total_emails_processed: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (CheckConstraint("id = 1", name="chk_email_sync_state_id"),)

"""RawMessage model representing immutable staging of incoming notifications."""

import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RawMessageSource(str, Enum):
    GMAIL = "GMAIL"
    SMS = "SMS"
    CSV = "CSV"
    MANUAL = "MANUAL"


class RawMessageStatus(str, Enum):
    INGESTED = "INGESTED"
    PARSED = "PARSED"
    PARSE_FAILED = "PARSE_FAILED"
    UNRESOLVED_ACCOUNT = "UNRESOLVED_ACCOUNT"
    IGNORED = "IGNORED"


class RawMessage(Base):
    __tablename__ = "raw_messages"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    source: Mapped[str] = mapped_column(
        String(50),
        default=RawMessageSource.GMAIL.value,
        nullable=False,
    )
    external_message_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
        doc="e.g. Gmail message ID or external tracking ID",
    )
    payload_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
        doc="SHA-256 cryptographic digest of raw payload for deduplication",
    )
    raw_headers: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="JSON or serialized headers (From, Subject, Date, etc.)",
    )
    raw_payload: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="Full raw email body, SMS text, or CSV line",
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default=RawMessageStatus.INGESTED.value,
        nullable=False,
    )
    parse_error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="Error stacktrace or explanation if parsing failed",
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        doc="Timestamp when message was received by provider",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )

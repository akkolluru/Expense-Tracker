import hashlib
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.models.raw_message import RawMessage


class StagingService:
    @staticmethod
    def compute_payload_hash(raw_body: str) -> str:
        return hashlib.sha256(raw_body.strip().encode("utf-8")).hexdigest()

    @classmethod
    async def ingest_raw_message(
        cls,
        session: AsyncSession,
        source: str,
        external_id: str,
        raw_body: str,
        sender: str | None = None,
        subject: str | None = None,
        raw_headers: str | None = None,
        received_at: datetime | None = None,
    ) -> tuple[RawMessage, bool]:
        """Ingests raw message. Returns (RawMessage, is_created)."""
        payload_hash = cls.compute_payload_hash(raw_body)

        stmt = select(RawMessage).where(RawMessage.payload_hash == payload_hash)
        res = await session.execute(stmt)
        existing = res.scalar_one_or_none()
        if existing:
            return (existing, False)

        msg = RawMessage(
            source=source,
            external_id=external_id,
            payload_hash=payload_hash,
            sender=sender,
            subject=subject,
            raw_body=raw_body,
            raw_headers=raw_headers,
            status="INGESTED",
            received_at=received_at or datetime.now(UTC),
        )
        session.add(msg)
        await session.commit()
        await session.refresh(msg)
        return (msg, True)

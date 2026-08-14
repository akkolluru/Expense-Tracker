"""Tests for RawMessage domain model, deduplication hash, and statuses."""

import hashlib
from datetime import UTC, datetime

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.raw_message import RawMessage, RawMessageSource, RawMessageStatus


@pytest.mark.asyncio
async def test_create_raw_message(db_session: AsyncSession):
    """Verify RawMessage persistence with cryptographic payload hash."""
    payload = "Your account XX1234 has been debited by INR 500.00 on 14-Aug-2026."
    payload_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()

    raw_msg = RawMessage(
        source=RawMessageSource.GMAIL.value,
        external_message_id="msg_12345abc",
        payload_hash=payload_hash,
        raw_headers='{"from": "alerts@hdfcbank.net", "subject": "Transaction Alert"}',
        raw_payload=payload,
        status=RawMessageStatus.INGESTED.value,
        received_at=datetime.now(UTC),
    )
    db_session.add(raw_msg)
    await db_session.commit()
    await db_session.refresh(raw_msg)

    assert raw_msg.id is not None
    assert len(raw_msg.id) == 36
    assert raw_msg.source == "GMAIL"
    assert raw_msg.external_message_id == "msg_12345abc"
    assert raw_msg.payload_hash == payload_hash
    assert raw_msg.status == "INGESTED"
    assert raw_msg.parse_error is None
    assert raw_msg.created_at is not None


@pytest.mark.asyncio
async def test_raw_message_duplicate_hash_raises_integrity_error(
    db_session: AsyncSession,
):
    """Verify cryptographic payload_hash enforces deduplication invariant."""
    payload_hash = hashlib.sha256(b"exact-duplicate-email-body").hexdigest()

    msg1 = RawMessage(
        source=RawMessageSource.GMAIL.value,
        external_message_id="msg_1",
        payload_hash=payload_hash,
        raw_payload="exact-duplicate-email-body",
        received_at=datetime.now(UTC),
    )
    db_session.add(msg1)
    await db_session.commit()

    msg2 = RawMessage(
        source=RawMessageSource.GMAIL.value,
        external_message_id="msg_2",
        payload_hash=payload_hash,
        raw_payload="exact-duplicate-email-body",
        received_at=datetime.now(UTC),
    )
    db_session.add(msg2)
    with pytest.raises(IntegrityError):
        await db_session.commit()


@pytest.mark.asyncio
async def test_raw_message_enums():
    """Verify standard RawMessageSource and RawMessageStatus enums."""
    assert RawMessageSource.GMAIL.value == "GMAIL"
    assert RawMessageSource.SMS.value == "SMS"
    assert RawMessageSource.CSV.value == "CSV"
    assert RawMessageSource.MANUAL.value == "MANUAL"

    assert RawMessageStatus.INGESTED.value == "INGESTED"
    assert RawMessageStatus.PARSED.value == "PARSED"
    assert RawMessageStatus.PARSE_FAILED.value == "PARSE_FAILED"
    assert RawMessageStatus.UNRESOLVED_ACCOUNT.value == "UNRESOLVED_ACCOUNT"
    assert RawMessageStatus.IGNORED.value == "IGNORED"

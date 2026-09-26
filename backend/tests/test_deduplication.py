from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from sqlalchemy import select

from expense_tracker.models.account import Account
from expense_tracker.models.category import Category
from expense_tracker.models.raw_message import RawMessage
from expense_tracker.models.transaction import Transaction
from expense_tracker.parsers.base import DraftTransaction
from expense_tracker.services.reconciliation import ReconciliationService

@pytest.mark.asyncio
async def test_sms_first_then_email_second_merge(async_session):
    # Setup HDFC account and Groceries category
    account = Account(
        name="HDFC Salary",
        institution="HDFC",
        account_type="SAVINGS",
        currency="INR",
        balance=Decimal("10000.00"),
        account_number_last4="4762",
        is_active=True
    )
    fallback_account = Account(
        name="Cash/Default",
        institution="CASH",
        account_type="CASH",
        currency="INR",
        balance=Decimal("5000.00"),
        is_active=True
    )
    category = Category(name="Groceries", color="#10B981")
    async_session.add_all([account, fallback_account, category])
    await async_session.commit()
    await async_session.refresh(account)
    await async_session.refresh(fallback_account)
    await async_session.refresh(category)

    # 1. SMS arrives: no account last4, short name, UTR present
    sms_raw = RawMessage(
        source="SMS",
        external_id="sms-zepto-1",
        payload_hash="sms_hash_1",
        raw_body="Rs.311.00 debited from acct to Zepto ref 127377523812",
        status="INGESTED",
        received_at=datetime(2026, 8, 4, 18, 0, tzinfo=timezone.utc)
    )
    async_session.add(sms_raw)
    await async_session.commit()
    await async_session.refresh(sms_raw)

    sms_draft = DraftTransaction(
        raw_message_id=sms_raw.id,
        account_institution="GENERIC",
        account_number_last4=None,
        amount=Decimal("311.00"),
        currency="INR",
        is_expense=True,
        merchant_name="Zepto",
        reference_number="127377523812",
        raw_timestamp=sms_raw.received_at
    )

    # Process SMS with fallback account
    tx1, is_new1 = await ReconciliationService.process_draft(
        async_session, sms_draft, fallback_account_id=fallback_account.id
    )
    assert is_new1 is True
    assert tx1.account_id == fallback_account.id
    assert tx1.amount == Decimal("311.00")
    assert tx1.reference_number == "127377523812"

    # User manually assigns Groceries category to tx1
    tx1.category_id = category.id
    await async_session.commit()

    # 2. Bank email arrives 15 mins later with rich metadata (HDFC last4, VPA, full name)
    email_raw = RawMessage(
        source="GMAIL",
        external_id="email-zepto-2",
        payload_hash="email_hash_2",
        raw_body="Rs.311.00 is debited from your account ending 4762 towards VPA zeptopgonline@ybl (ZEPTO MARKETPLACE PRIVATE LIMITED) on 04-08-26. UPI transaction reference no.: 127377523812.",
        status="INGESTED",
        received_at=datetime(2026, 8, 4, 18, 15, tzinfo=timezone.utc)
    )
    async_session.add(email_raw)
    await async_session.commit()
    await async_session.refresh(email_raw)

    email_draft = DraftTransaction(
        raw_message_id=email_raw.id,
        account_institution="HDFC",
        account_number_last4="4762",
        amount=Decimal("311.00"),
        currency="INR",
        is_expense=True,
        merchant_name="ZEPTO MARKETPLACE PRIVATE LIMITED",
        merchant_vpa="zeptopgonline@ybl",
        reference_number="127377523812",
        raw_timestamp=email_raw.received_at
    )

    tx2, is_new2 = await ReconciliationService.process_draft(
        async_session, email_draft, fallback_account_id=fallback_account.id
    )

    # Assert: merged into existing tx1
    assert is_new2 is False
    assert tx2.id == tx1.id
    assert tx2.category_id == category.id  # User category preserved!
    assert tx2.merchant_vpa == "zeptopgonline@ybl"  # VPA enriched
    assert tx2.account_id == account.id  # Verified account assigned
    
    # Assert email raw_message marked as MERGED
    await async_session.refresh(email_raw)
    assert email_raw.status == "MERGED"

    # Assert total transactions is 1
    stmt = select(Transaction)
    res = await async_session.execute(stmt)
    all_txs = res.scalars().all()
    assert len(all_txs) == 1

@pytest.mark.asyncio
async def test_email_first_then_sms_second_merge(async_session):
    account = Account(
        name="HDFC Salary",
        institution="HDFC",
        account_type="SAVINGS",
        balance=Decimal("20000.00"),
        account_number_last4="4762",
        is_active=True
    )
    async_session.add(account)
    await async_session.commit()
    await async_session.refresh(account)

    email_raw = RawMessage(
        source="GMAIL",
        external_id="email-swiggy-1",
        payload_hash="swiggy_email_hash",
        raw_body="Rs.450.00 debited from account ending 4762 towards Swiggy ref 998877112233",
        status="INGESTED",
        received_at=datetime(2026, 8, 5, 12, 0, tzinfo=timezone.utc)
    )
    async_session.add(email_raw)
    await async_session.commit()
    await async_session.refresh(email_raw)

    email_draft = DraftTransaction(
        raw_message_id=email_raw.id,
        account_institution="HDFC",
        account_number_last4="4762",
        amount=Decimal("450.00"),
        currency="INR",
        is_expense=True,
        merchant_name="Swiggy",
        reference_number="998877112233",
        raw_timestamp=email_raw.received_at
    )

    tx1, is_new1 = await ReconciliationService.process_draft(async_session, email_draft)
    assert is_new1 is True

    # Balance deducted once: 20000 - 450 = 19550
    await async_session.refresh(account)
    assert account.balance == Decimal("19550.00")

    # SMS arrives 2 hours later with same UTR
    sms_raw = RawMessage(
        source="SMS",
        external_id="sms-swiggy-2",
        payload_hash="swiggy_sms_hash",
        raw_body="INR 450 debited towards Swiggy ref 998877112233",
        status="INGESTED",
        received_at=datetime(2026, 8, 5, 14, 0, tzinfo=timezone.utc)
    )
    async_session.add(sms_raw)
    await async_session.commit()
    await async_session.refresh(sms_raw)

    sms_draft = DraftTransaction(
        raw_message_id=sms_raw.id,
        account_institution="GENERIC",
        amount=Decimal("450.00"),
        is_expense=True,
        merchant_name="Swiggy",
        reference_number="998877112233",
        raw_timestamp=sms_raw.received_at
    )

    tx2, is_new2 = await ReconciliationService.process_draft(async_session, sms_draft)
    assert is_new2 is False
    assert tx2.id == tx1.id

    # Balance is NOT deducted again!
    await async_session.refresh(account)
    assert account.balance == Decimal("19550.00")

@pytest.mark.asyncio
async def test_fallback_signature_deduplication(async_session):
    account = Account(
        name="ICICI",
        institution="ICICI",
        account_type="SAVINGS",
        balance=Decimal("15000.00"),
        account_number_last4="1111",
        is_active=True
    )
    async_session.add(account)
    await async_session.commit()
    await async_session.refresh(account)

    t0 = datetime(2026, 8, 6, 10, 0, tzinfo=timezone.utc)
    
    # Alert 1 without UTR
    msg1 = RawMessage(
        source="SMS", external_id="m1", payload_hash="h1", raw_body="body1",
        received_at=t0
    )
    async_session.add(msg1)
    await async_session.commit()

    draft1 = DraftTransaction(
        raw_message_id=msg1.id,
        account_institution="ICICI",
        account_number_last4="1111",
        amount=Decimal("200.00"),
        merchant_name="Local Cafe",
        reference_number=None,
        raw_timestamp=t0
    )
    tx1, is_new1 = await ReconciliationService.process_draft(async_session, draft1)
    assert is_new1 is True

    # Alert 2 without UTR 4 minutes later with same amount and account
    t1 = t0 + timedelta(minutes=4)
    msg2 = RawMessage(
        source="GMAIL", external_id="m2", payload_hash="h2", raw_body="body2",
        received_at=t1
    )
    async_session.add(msg2)
    await async_session.commit()

    draft2 = DraftTransaction(
        raw_message_id=msg2.id,
        account_institution="ICICI",
        account_number_last4="1111",
        amount=Decimal("200.00"),
        merchant_name="Local Cafe",
        reference_number=None,
        raw_timestamp=t1
    )
    tx2, is_new2 = await ReconciliationService.process_draft(async_session, draft2)
    assert is_new2 is False
    assert tx2.id == tx1.id

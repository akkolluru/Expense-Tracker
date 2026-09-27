from datetime import UTC, datetime
from decimal import Decimal

import pytest

from expense_tracker.models.account import Account
from expense_tracker.models.raw_message import RawMessage
from expense_tracker.parsers.base import DraftTransaction
from expense_tracker.parsers.generic import GenericUpiParser
from expense_tracker.parsers.hdfc import HdfcCardParser, HdfcUpiParser
from expense_tracker.parsers.icici import IciciAlertParser
from expense_tracker.parsers.registry import BankParserRegistry
from expense_tracker.services.account_resolver import AccountResolver
from expense_tracker.services.staging import StagingService


@pytest.mark.asyncio
async def test_staging_service_deduplication(async_session):
    raw_body = "Dear Customer, Rs.500.00 debited from account ending 1234 on 01-01-26."
    msg1, created1 = await StagingService.ingest_raw_message(
        async_session,
        source="GMAIL",
        external_id="gmail-msg-101",
        raw_body=raw_body,
        sender="alerts@hdfcbank.net",
        subject="UPI Alert",
        received_at=datetime(2026, 1, 1, 10, 0, tzinfo=UTC),
    )
    assert created1 is True
    assert msg1.id is not None
    assert msg1.status == "INGESTED"
    assert len(msg1.payload_hash) == 64

    # Second ingestion of the same raw body must be deduplicated
    msg2, created2 = await StagingService.ingest_raw_message(
        async_session,
        source="GMAIL",
        external_id="gmail-msg-102",
        raw_body=raw_body,
        sender="alerts@hdfcbank.net",
        subject="UPI Alert",
        received_at=datetime(2026, 1, 1, 10, 5, tzinfo=UTC),
    )
    assert created2 is False
    assert msg2.id == msg1.id
    assert msg2.payload_hash == msg1.payload_hash


def test_hdfc_upi_parser_from_real_fixture():
    raw_body = (
        "Dear Customer,\n\n"
        "Greetings from HDFC Bank!\n\n"
        "Rs.60.00 is debited from your account ending 4762 towards VPA "
        "q816661384@ybl (JAI MATHA DI CHAT BHANDAR) on 04-08-26.\n\n"
        "UPI transaction reference no.: 127367628449.\n\n"
        "Warm regards,\nHDFC Bank"
    )
    msg = RawMessage(
        id=1,
        source="GMAIL",
        external_id="msg-1",
        payload_hash="hash1",
        sender="alerts@hdfcbank.bank.in",
        subject="You have done a UPI txn. Check details!",
        raw_body=raw_body,
        received_at=datetime(2026, 8, 4, 17, 35, tzinfo=UTC),
    )
    parser = HdfcUpiParser()
    assert parser.can_handle(msg) is True

    drafts = parser.parse(msg)
    assert len(drafts) == 1
    draft = drafts[0]
    assert draft.amount == Decimal("60.00")
    assert draft.account_number_last4 == "4762"
    assert draft.account_institution == "HDFC"
    assert draft.is_expense is True
    assert draft.merchant_vpa == "q816661384@ybl"
    assert draft.merchant_name == "JAI MATHA DI CHAT BHANDAR"
    assert draft.reference_number == "127367628449"


def test_hdfc_card_parser():
    raw_body = (
        "Rs.1,450.00 was spent on your HDFC Bank Credit Card ending **9482 "
        "at AMAZON INDIA on 2026-08-10 14:30:00."
    )
    msg = RawMessage(
        id=2,
        source="GMAIL",
        external_id="msg-2",
        payload_hash="hash2",
        sender="alerts@hdfcbank.net",
        subject="Transaction alert for your HDFC Bank Card",
        raw_body=raw_body,
        received_at=datetime(2026, 8, 10, 14, 30, tzinfo=UTC),
    )
    parser = HdfcCardParser()
    assert parser.can_handle(msg) is True

    drafts = parser.parse(msg)
    assert len(drafts) == 1
    draft = drafts[0]
    assert draft.amount == Decimal("1450.00")
    assert draft.account_number_last4 == "9482"
    assert draft.account_institution == "HDFC"
    assert draft.merchant_name == "AMAZON INDIA"
    assert draft.is_expense is True


def test_icici_alert_parser():
    raw_body = (
        "Account **1234 is debited with INR 2,500.00 on 12-08-2026 18:20:00 "
        "towards SWIGGY. UPI Ref No 987654321012."
    )
    msg = RawMessage(
        id=3,
        source="GMAIL",
        external_id="msg-3",
        payload_hash="hash3",
        sender="alerts@icicibank.com",
        subject="Transaction alert for your ICICI Bank Account",
        raw_body=raw_body,
        received_at=datetime(2026, 8, 12, 18, 20, tzinfo=UTC),
    )
    parser = IciciAlertParser()
    assert parser.can_handle(msg) is True

    drafts = parser.parse(msg)
    assert len(drafts) == 1
    draft = drafts[0]
    assert draft.amount == Decimal("2500.00")
    assert draft.account_number_last4 == "1234"
    assert draft.account_institution == "ICICI"
    assert draft.merchant_name == "SWIGGY"
    assert draft.reference_number == "987654321012"
    assert draft.is_expense is True


def test_generic_upi_parser():
    raw_body = "INR 350.00 debited from A/c **9999 to uber@hdfcbank on 05-09-2026 ref 443322110099"
    msg = RawMessage(
        id=4,
        source="SMS",
        external_id="sms-1",
        payload_hash="hash4",
        sender="VK-PAYTM",
        subject=None,
        raw_body=raw_body,
        received_at=datetime(2026, 9, 5, 12, 0, tzinfo=UTC),
    )
    parser = GenericUpiParser()
    assert parser.can_handle(msg) is True

    drafts = parser.parse(msg)
    assert len(drafts) == 1
    draft = drafts[0]
    assert draft.amount == Decimal("350.00")
    assert draft.account_number_last4 == "9999"
    assert draft.reference_number == "443322110099"


def test_registry_dispatch():
    registry = BankParserRegistry.get_default()
    msg = RawMessage(
        id=5,
        source="GMAIL",
        external_id="msg-5",
        payload_hash="hash5",
        sender="alerts@hdfcbank.bank.in",
        subject="You have done a UPI txn. Check details!",
        raw_body="Rs.100.00 is debited from your account ending 4762 towards VPA food@upi (FOOD POINT) on 04-08-26. UPI transaction reference no.: 998877665544.",
        received_at=datetime(2026, 8, 4, 20, 0, tzinfo=UTC),
    )
    drafts = registry.parse_raw_message(msg)
    assert len(drafts) == 1
    assert drafts[0].merchant_name == "FOOD POINT"
    assert drafts[0].amount == Decimal("100.00")


@pytest.mark.asyncio
async def test_account_resolver(async_session):
    account = Account(
        name="HDFC Salary Account",
        institution="HDFC",
        account_type="SAVINGS",
        currency="INR",
        balance=Decimal("10000.00"),
        account_number_last4="4762",
        is_active=True,
    )
    async_session.add(account)
    await async_session.commit()
    await async_session.refresh(account)

    draft = DraftTransaction(
        raw_message_id=1,
        account_institution="HDFC",
        account_number_last4="4762",
        amount=Decimal("100.00"),
        currency="INR",
        is_expense=True,
        is_transfer=False,
        merchant_name="Zomato",
        raw_timestamp=datetime.now(UTC),
    )

    resolved = await AccountResolver.resolve(async_session, draft)
    assert resolved is not None
    assert resolved.id == account.id

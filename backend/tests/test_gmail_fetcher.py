import base64
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.api.app import create_app
from expense_tracker.api.deps import get_db
from expense_tracker.models.account import Account
from expense_tracker.models.transaction import Transaction
from expense_tracker.services.gmail_fetcher import GmailFetcherService


@pytest.mark.asyncio
async def test_gmail_fetcher_missing_credentials(
    async_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("GMAIL_TOKEN_PATH", "/non/existent/path/token.json")
    result = await GmailFetcherService.fetch_and_process_emails(async_session)
    assert result.status == "CREDENTIALS_MISSING"
    assert result.messages_fetched == 0
    assert result.transactions_created == 0


@pytest.mark.asyncio
async def test_gmail_fetcher_with_mocked_service(async_session: AsyncSession) -> None:
    # 1. Seed account with matching last4
    account = Account(
        name="HDFC Salary",
        institution="HDFC",
        account_type="SAVINGS",
        currency="INR",
        balance=Decimal("10000.00"),
        account_number_last4="4590",
        is_active=True,
    )
    async_session.add(account)
    await async_session.commit()

    # 2. Build mock Gmail API service
    mock_service = MagicMock()
    mock_messages_resource = MagicMock()
    mock_service.users().messages.return_value = mock_messages_resource

    # List messages mock
    mock_messages_resource.list().execute.return_value = {
        "messages": [{"id": "gmail_msg_101"}]
    }

    raw_email_body = (
        "Dear Customer,\n"
        "Rs 450.00 has been debited from your account **4590 to VPA zomato@icici "
        "(UPI Ref No 987654321012) on 05-Oct-26.\n"
        "Total Avail.bal is INR 9,550.00."
    )
    encoded_body = base64.urlsafe_b64encode(raw_email_body.encode("utf-8")).decode("utf-8")

    # Get message mock
    mock_messages_resource.get().execute.return_value = {
        "id": "gmail_msg_101",
        "internalDate": "1760000000000",
        "payload": {
            "mimeType": "text/plain",
            "headers": [
                {"name": "From", "value": "alerts@hdfcbank.net"},
                {"name": "Subject", "value": "Alert: You have debited Rs 450.00 via UPI"},
            ],
            "body": {"data": encoded_body},
        },
    }

    # 3. Fetch and process
    result = await GmailFetcherService.fetch_and_process_emails(
        async_session, custom_service=mock_service
    )

    assert result.status == "SUCCESS"
    assert result.messages_fetched == 1
    assert result.transactions_created == 1

    # 4. Verify transaction in DB
    stmt = select(Transaction).where(Transaction.reference_number == "987654321012")
    res = await async_session.execute(stmt)
    tx = res.scalar_one_or_none()
    assert tx is not None
    assert tx.amount == Decimal("450.00")
    assert tx.account_id == account.id


@pytest.mark.asyncio
async def test_sync_gmail_endpoint(async_session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SERVER_API_KEY", "test-api-key")

    app = create_app()

    async def override_get_db():
        yield async_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/sync/gmail",
            headers={"X-API-Key": "test-api-key"},
        )
        assert resp.status_code == 202
        data = resp.json()
        assert data["status"] == "SYNC_STARTED"
        assert "Gmail poller initiated" in data["message"]

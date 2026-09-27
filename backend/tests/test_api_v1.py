from datetime import UTC, datetime
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient

from expense_tracker.api.app import create_app
from expense_tracker.models.account import Account
from expense_tracker.models.category import Category
from expense_tracker.models.transaction import Transaction

API_KEY = "test-api-key"
HEADERS = {"X-API-Key": API_KEY}


@pytest.fixture
def app(monkeypatch):
    monkeypatch.setenv("SERVER_API_KEY", API_KEY)
    return create_app()


@pytest.fixture
async def client(app, async_session):
    # Dependency override for database session
    from expense_tracker.api.deps import get_db

    app.dependency_overrides[get_db] = lambda: async_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_security_x_api_key(client):
    # No header -> 401
    res1 = await client.get("/api/v1/accounts")
    assert res1.status_code == 401

    # Invalid header -> 401
    res2 = await client.get("/api/v1/accounts", headers={"X-API-Key": "wrong-key"})
    assert res2.status_code == 401

    # Valid header -> 200
    res3 = await client.get("/api/v1/accounts", headers=HEADERS)
    assert res3.status_code == 200


@pytest.mark.asyncio
async def test_accounts_endpoints(client):
    payload = {
        "name": "HDFC Salary Account",
        "institution": "HDFC",
        "account_type": "SAVINGS",
        "currency": "INR",
        "initial_balance": "50000.00",
        "account_number_last4": "4762",
    }
    create_res = await client.post("/api/v1/accounts", json=payload, headers=HEADERS)
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["name"] == "HDFC Salary Account"
    assert data["balance"] == "50000.00"
    account_id = data["id"]

    list_res = await client.get("/api/v1/accounts", headers=HEADERS)
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) >= 1
    assert any(acc["id"] == account_id for acc in items)


@pytest.mark.asyncio
async def test_transactions_and_splits_endpoints(client, async_session):
    account = Account(
        name="Spend Account",
        institution="HDFC",
        balance=Decimal("10000.00"),
        account_type="SAVINGS",
        is_active=True,
    )
    cat_food = Category(name="Food", color="#F00")
    cat_bills = Category(name="Bills", color="#00F")
    async_session.add_all([account, cat_food, cat_bills])
    await async_session.commit()
    await async_session.refresh(account)
    await async_session.refresh(cat_food)
    await async_session.refresh(cat_bills)

    # 1. Create transaction
    tx_payload = {
        "account_id": account.id,
        "amount": "2000.00",
        "merchant_name": "Supermarket",
        "timestamp": datetime.now(UTC).isoformat(),
        "is_expense": True,
    }
    tx_res = await client.post("/api/v1/transactions", json=tx_payload, headers=HEADERS)
    assert tx_res.status_code == 201
    tx_data = tx_res.json()
    assert tx_data["amount"] == "2000.00"
    tx_id = tx_data["id"]

    # 2. Split transaction
    split_payload = {
        "splits": [
            {"category_id": cat_food.id, "amount": "1500.00", "note": "Groceries"},
            {"category_id": cat_bills.id, "amount": "500.00", "note": "Cleaning"},
        ]
    }
    split_res = await client.post(
        f"/api/v1/transactions/{tx_id}/split", json=split_payload, headers=HEADERS
    )
    assert split_res.status_code == 200
    splits_data = split_res.json()
    assert len(splits_data) == 2

    # 3. Invalid split sum returns 400
    bad_split = {"splits": [{"category_id": cat_food.id, "amount": "1000.00", "note": "Groceries"}]}
    bad_res = await client.post(
        f"/api/v1/transactions/{tx_id}/split", json=bad_split, headers=HEADERS
    )
    assert bad_res.status_code == 400


@pytest.mark.asyncio
async def test_idempotency_key_endpoint(client, async_session):
    account = Account(
        name="Wallet",
        institution="CASH",
        balance=Decimal("5000.00"),
        account_type="CASH",
        is_active=True,
    )
    async_session.add(account)
    await async_session.commit()
    await async_session.refresh(account)

    tx_payload = {
        "account_id": account.id,
        "amount": "500.00",
        "merchant_name": "Bookstore",
        "timestamp": datetime.now(UTC).isoformat(),
        "is_expense": True,
        "idempotency_key": "unique-idemp-key-101",
    }

    # First request
    res1 = await client.post(
        "/api/v1/transactions",
        json=tx_payload,
        headers={"X-API-Key": API_KEY, "X-Idempotency-Key": "unique-idemp-key-101"},
    )
    assert res1.status_code == 201
    d1 = res1.json()

    # Second request with same idempotency key
    res2 = await client.post(
        "/api/v1/transactions",
        json=tx_payload,
        headers={"X-API-Key": API_KEY, "X-Idempotency-Key": "unique-idemp-key-101"},
    )
    assert res2.status_code == 200 or res2.status_code == 201
    d2 = res2.json()
    assert d2["id"] == d1["id"]

    # Verify balance was deducted only once: 5000 - 500 = 4500
    await async_session.refresh(account)
    assert account.balance == Decimal("4500.00")


@pytest.mark.asyncio
async def test_sync_parse_text_endpoint(client, async_session):
    account = Account(
        name="HDFC Salary",
        institution="HDFC",
        balance=Decimal("20000.00"),
        account_number_last4="4762",
        is_active=True,
    )
    async_session.add(account)
    await async_session.commit()
    await async_session.refresh(account)

    raw_sms = (
        "Dear Customer, Rs.60.00 is debited from your account ending 4762 towards VPA "
        "q816661384@ybl (JAI MATHA DI CHAT BHANDAR) on 04-08-26. UPI transaction reference no.: 127367628449."
    )
    res = await client.post(
        "/api/v1/sync/parse-text", json={"raw_text": raw_sms, "source": "SMS"}, headers=HEADERS
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ["CREATED", "MERGED"]
    tx = data["transaction"]
    assert tx["amount"] == "60.00"
    assert tx["merchant_name"] == "JAI MATHA DI CHAT BHANDAR"
    assert tx["reference_number"] == "127367628449"


@pytest.mark.asyncio
async def test_inbox_and_approve_endpoint(client, async_session):
    account = Account(name="HDFC", institution="HDFC", balance=Decimal("10000.00"), is_active=True)
    category = Category(name="Snacks", color="#F59E0B")
    async_session.add_all([account, category])
    await async_session.commit()
    await async_session.refresh(account)
    await async_session.refresh(category)

    # Insert a transaction with PENDING_REVIEW
    tx = Transaction(
        account_id=account.id,
        amount=Decimal("150.00"),
        merchant_name="Unknown Tea Stall",
        merchant_vpa="chai@upi",
        status="PENDING_REVIEW",
        is_expense=True,
        categorization_strategy="MANUAL",
        categorization_confidence=0.5,
        suggested_category_id=category.id,
        timestamp=datetime.now(UTC),
    )
    async_session.add(tx)
    await async_session.commit()
    await async_session.refresh(tx)

    # 1. GET /api/v1/inbox
    inbox_res = await client.get("/api/v1/inbox", headers=HEADERS)
    assert inbox_res.status_code == 200
    items = inbox_res.json()
    assert len(items) >= 1
    assert any(i["id"] == tx.id for i in items)

    # 2. POST /api/v1/inbox/{id}/approve
    approve_res = await client.post(
        f"/api/v1/inbox/{tx.id}/approve",
        json={"category_id": category.id, "learn_merchant": True},
        headers=HEADERS,
    )
    assert approve_res.status_code == 200
    appr_data = approve_res.json()
    assert appr_data["status"] == "POSTED"
    assert appr_data["category_id"] == category.id


@pytest.mark.asyncio
async def test_system_health_endpoint(client):
    res = await client.get("/api/v1/system/health", headers=HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HEALTHY"
    assert data["database"] == "CONNECTED"
    assert "llm_circuit_breaker" in data

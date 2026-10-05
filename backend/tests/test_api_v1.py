from datetime import UTC, datetime
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from expense_tracker.api.app import create_app
from expense_tracker.models.account import Account
from expense_tracker.models.category import Category
from expense_tracker.models.rule import MerchantMemory
from expense_tracker.models.transaction import Transaction
from expense_tracker.parsers.base import DraftTransaction
from expense_tracker.services.categorization import CategorizationService

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
async def test_transaction_negative_amount_rejected(client):
    payload = {
        "account_id": 1,
        "amount": "-500.00",
        "merchant_name": "Invalid Merchant",
        "timestamp": datetime.now(UTC).isoformat(),
    }
    res = await client.post("/api/v1/transactions", json=payload, headers=HEADERS)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_transaction_zero_amount_rejected(client):
    payload = {
        "account_id": 1,
        "amount": "0.00",
        "merchant_name": "Zero Merchant",
        "timestamp": datetime.now(UTC).isoformat(),
    }
    res = await client.post("/api/v1/transactions", json=payload, headers=HEADERS)
    assert res.status_code == 422


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
async def test_inbox_approve_with_never_auto_classify(client, async_session):
    account = Account(name="SBI Savings", institution="SBI", balance=Decimal("15000.00"), is_active=True)
    cat_food = Category(name="Dinner", color="#EF4444")
    async_session.add_all([account, cat_food])
    await async_session.commit()
    await async_session.refresh(account)
    await async_session.refresh(cat_food)

    # 1. Insert a transaction with PENDING_REVIEW for a friend
    tx = Transaction(
        account_id=account.id,
        amount=Decimal("650.00"),
        merchant_name="Aakash Friend",
        merchant_vpa="aakash@upi",
        status="PENDING_REVIEW",
        is_expense=True,
        categorization_strategy="MANUAL",
        categorization_confidence=0.0,
        timestamp=datetime.now(UTC),
    )
    async_session.add(tx)
    await async_session.commit()
    await async_session.refresh(tx)

    # 2. Approve with never_auto_classify=True
    approve_res = await client.post(
        f"/api/v1/inbox/{tx.id}/approve",
        json={"category_id": cat_food.id, "never_auto_classify": True},
        headers=HEADERS,
    )
    assert approve_res.status_code == 200
    appr_data = approve_res.json()
    assert appr_data["status"] == "POSTED"
    assert appr_data["category_id"] == cat_food.id

    # 3. Verify MerchantMemory has never_auto_classify == True
    stmt = select(MerchantMemory).where(MerchantMemory.merchant_key == "aakash@upi")
    res = await async_session.execute(stmt)
    memory = res.scalar_one_or_none()
    assert memory is not None
    assert memory.never_auto_classify is True

    # 4. Subsequent transaction for the same merchant/vpa via CategorizationService
    next_draft = DraftTransaction(
        raw_message_id=None,
        account_institution="SBI",
        amount=Decimal("300.00"),
        merchant_name="Aakash Friend",
        merchant_vpa="aakash@upi",
    )
    next_tx = await CategorizationService.process_and_record(
        session=async_session,
        draft=next_draft,
        account_id=account.id,
    )
    assert next_tx.status == "PENDING_REVIEW"
    assert next_tx.categorization_strategy == "NEVER_AUTO_CLASSIFY"
    assert next_tx.category_id is None

    # 5. Verify it appears in GET /api/v1/inbox
    inbox_res = await client.get("/api/v1/inbox", headers=HEADERS)
    assert inbox_res.status_code == 200
    inbox_items = inbox_res.json()
    assert any(item["id"] == next_tx.id for item in inbox_items)



@pytest.mark.asyncio
async def test_system_health_endpoint(client):
    res = await client.get("/api/v1/system/health", headers=HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HEALTHY"
    assert data["database"] == "CONNECTED"
    assert "llm_circuit_breaker" in data


@pytest.mark.asyncio
async def test_categories_endpoint(client, async_session):
    cat1 = Category(name="Travel", icon="plane", color="#3B82F6", is_income=False)
    cat2 = Category(name="Dining", icon="utensils", color="#EF4444", is_income=False)
    cat3 = Category(name="Salary", icon="briefcase", color="#10B981", is_income=True)
    async_session.add_all([cat1, cat2, cat3])
    await async_session.commit()

    res = await client.get("/api/v1/categories", headers=HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 3

    # Check alphabetical ordering
    names = [c["name"] for c in data]
    assert names == sorted(names)

    # Check fields
    travel = next(c for c in data if c["name"] == "Travel")
    assert travel["icon"] == "plane"
    assert travel["color"] == "#3B82F6"
    assert travel["is_income"] is False
    assert "parent_category" in travel


@pytest.mark.asyncio
async def test_peer_splits_endpoints(client, async_session):
    account = Account(
        name="Splits Test Account",
        institution="Axis",
        balance=Decimal("10000.00"),
    )
    async_session.add(account)
    await async_session.commit()
    await async_session.refresh(account)

    tx = Transaction(
        account_id=account.id,
        amount=Decimal("1000.00"),
        merchant_name="Group Dinner",
        timestamp=datetime.now(UTC),
    )
    async_session.add(tx)
    await async_session.commit()
    await async_session.refresh(tx)

    # 1. 404 for nonexistent transaction
    res_404 = await client.post(
        "/api/v1/transactions/99999/peer-splits",
        json={"peer_splits": [{"member_name": "Alice", "share_amount": "200.00"}]},
        headers=HEADERS,
    )
    assert res_404.status_code == 404

    # 2. 400 when splits sum exceeds tx amount (600 + 500 = 1100 > 1000)
    res_400 = await client.post(
        f"/api/v1/transactions/{tx.id}/peer-splits",
        json={
            "peer_splits": [
                {"member_name": "Alice", "share_amount": "600.00"},
                {"member_name": "Bob", "share_amount": "500.00"},
            ]
        },
        headers=HEADERS,
    )
    assert res_400.status_code == 400
    assert "exceeds transaction amount" in res_400.json()["detail"]

    # 3. Successful peer splits creation
    res_ok = await client.post(
        f"/api/v1/transactions/{tx.id}/peer-splits",
        json={
            "peer_splits": [
                {"member_name": "Alice", "share_amount": "400.00", "upi_id": "alice@upi"},
                {"member_name": "Bob", "share_amount": "300.00", "is_paid": False},
            ]
        },
        headers=HEADERS,
    )
    assert res_ok.status_code == 200
    splits_data = res_ok.json()
    assert len(splits_data) == 2
    alice_split = splits_data[0]
    bob_split = splits_data[1]
    assert alice_split["member_name"] == "Alice"
    assert bob_split["member_name"] == "Bob"
    assert Decimal(str(alice_split["share_amount"])) == Decimal("400.00")
    assert alice_split["upi_id"] == "alice@upi"
    assert alice_split["is_paid"] is False
    assert alice_split["settled_at"] is None

    # 4. Replacement of peer splits
    res_replace = await client.post(
        f"/api/v1/transactions/{tx.id}/peer-splits",
        json={
            "peer_splits": [
                {"member_name": "Charlie", "share_amount": "500.00", "upi_id": "charlie@upi"},
            ]
        },
        headers=HEADERS,
    )
    assert res_replace.status_code == 200
    replaced_data = res_replace.json()
    assert len(replaced_data) == 1
    charlie_split = replaced_data[0]
    assert charlie_split["member_name"] == "Charlie"
    charlie_id = charlie_split["id"]

    # 5. Toggle paid: toggle to True
    res_toggle_true = await client.post(
        f"/api/v1/transactions/{tx.id}/peer-splits/{charlie_id}/toggle-paid",
        headers=HEADERS,
    )
    assert res_toggle_true.status_code == 200
    toggled_true_data = res_toggle_true.json()
    assert toggled_true_data["is_paid"] is True
    assert toggled_true_data["settled_at"] is not None

    # 6. Toggle paid: toggle back to False
    res_toggle_false = await client.post(
        f"/api/v1/transactions/{tx.id}/peer-splits/{charlie_id}/toggle-paid",
        headers=HEADERS,
    )
    assert res_toggle_false.status_code == 200
    toggled_false_data = res_toggle_false.json()
    assert toggled_false_data["is_paid"] is False
    assert toggled_false_data["settled_at"] is None

    # 7. 404 for invalid toggle
    res_invalid_toggle = await client.post(
        f"/api/v1/transactions/{tx.id}/peer-splits/99999/toggle-paid",
        headers=HEADERS,
    )
    assert res_invalid_toggle.status_code == 404

    # 8. Check that GET transactions includes peer_splits
    res_list = await client.get("/api/v1/transactions", headers=HEADERS)
    assert res_list.status_code == 200
    tx_items = res_list.json()["items"]
    fetched_tx = next(t for t in tx_items if t["id"] == tx.id)
    assert len(fetched_tx["peer_splits"]) == 1
    assert fetched_tx["peer_splits"][0]["member_name"] == "Charlie"


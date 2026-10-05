from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.api.app import create_app
from expense_tracker.models.account import Account
from expense_tracker.models.category import Category
from expense_tracker.models.transaction import Transaction
from expense_tracker.services.analytics import AnalyticsService

API_KEY = "test-api-key"
HEADERS = {"X-API-Key": API_KEY}


@pytest.fixture
def app(monkeypatch):
    monkeypatch.setenv("SERVER_API_KEY", API_KEY)
    return create_app()


@pytest.fixture
async def client(app, async_session):
    from expense_tracker.api.deps import get_db

    app.dependency_overrides[get_db] = lambda: async_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
async def analytics_data(async_session: AsyncSession):
    # Setup test data
    account = Account(
        name="Test Account", institution="Test", balance=Decimal("0.0"), account_type="SAVINGS"
    )
    cat_food = Category(name="Food", color="#F00", icon="burger")
    cat_salary = Category(name="Salary", color="#0F0", icon="money")
    async_session.add_all([account, cat_food, cat_salary])
    await async_session.flush()

    now = datetime(2026, 10, 15, 12, 0, tzinfo=UTC)
    prev_month = datetime(2026, 9, 15, 12, 0, tzinfo=UTC)

    transactions = [
        # Current month income
        Transaction(
            account_id=account.id,
            category_id=cat_salary.id,
            amount=Decimal("5000.00"),
            merchant_name="Employer",
            timestamp=now,
            is_expense=False,
            is_transfer=False,
        ),
        # Current month expenses
        Transaction(
            account_id=account.id,
            category_id=cat_food.id,
            amount=Decimal("500.00"),
            merchant_name="Restaurant 1",
            timestamp=now,
            is_expense=True,
            is_transfer=False,
        ),
        Transaction(
            account_id=account.id,
            category_id=cat_food.id,
            amount=Decimal("200.00"),
            merchant_name="Restaurant 2",
            timestamp=now + timedelta(days=1),
            is_expense=True,
            is_transfer=False,
        ),
        # Current month transfer (ignored)
        Transaction(
            account_id=account.id,
            category_id=cat_food.id,
            amount=Decimal("100.00"),
            merchant_name="Transfer",
            timestamp=now,
            is_expense=True,
            is_transfer=True,
        ),
        # Previous month expenses
        Transaction(
            account_id=account.id,
            category_id=cat_food.id,
            amount=Decimal("1000.00"),
            merchant_name="Restaurant 3",
            timestamp=prev_month,
            is_expense=True,
            is_transfer=False,
        ),
    ]
    async_session.add_all(transactions)
    await async_session.commit()

    return {
        "account": account,
        "cat_food": cat_food,
        "cat_salary": cat_salary,
        "now": now,
        "prev_month": prev_month,
    }


@pytest.mark.asyncio
async def test_get_summary_metrics(async_session, analytics_data):
    start_date = datetime(2026, 10, 1, tzinfo=UTC)
    end_date = datetime(2026, 10, 31, tzinfo=UTC)

    result = await AnalyticsService.get_summary_metrics(async_session, start_date, end_date)

    assert result["income"] == 5000.0
    assert result["burn_rate"] == 700.0
    assert result["savings_rate"] == ((5000 - 700) / 5000) * 100


@pytest.mark.asyncio
async def test_get_category_breakdown(async_session, analytics_data):
    start_date = datetime(2026, 10, 1, tzinfo=UTC)
    end_date = datetime(2026, 10, 31, tzinfo=UTC)

    result = await AnalyticsService.get_category_breakdown(async_session, start_date, end_date)

    assert len(result) == 1
    assert result[0]["category_id"] == analytics_data["cat_food"].id
    assert result[0]["name"] == "Food"
    assert result[0]["amount"] == 700.0


@pytest.mark.asyncio
async def test_get_top_spends(async_session, analytics_data):
    start_date = datetime(2026, 10, 1, tzinfo=UTC)
    end_date = datetime(2026, 10, 31, tzinfo=UTC)
    cat_food_id = analytics_data["cat_food"].id

    result = await AnalyticsService.get_top_spends(
        async_session, cat_food_id, start_date, end_date, limit=1
    )

    assert len(result) == 1
    assert result[0]["merchant_name"] == "Restaurant 1"
    assert result[0]["amount"] == 500.0


@pytest.mark.asyncio
async def test_get_mom_variance(async_session, analytics_data):
    curr_start = datetime(2026, 10, 1, tzinfo=UTC)
    curr_end = datetime(2026, 10, 31, tzinfo=UTC)
    prev_start = datetime(2026, 9, 1, tzinfo=UTC)
    prev_end = datetime(2026, 9, 30, tzinfo=UTC)

    result = await AnalyticsService.get_mom_variance(
        async_session, curr_start, curr_end, prev_start, prev_end
    )

    assert result["current_burn"] == 700.0
    assert result["prev_burn"] == 1000.0
    assert result["variance_percentage"] == ((700 - 1000) / 1000) * 100


# API Tests


@pytest.mark.asyncio
async def test_api_get_summary(client, analytics_data):
    start_date = "2026-10-01T00:00:00Z"
    end_date = "2026-10-31T23:59:59Z"

    res = await client.get(
        f"/api/v1/analytics/summary?start_date={start_date}&end_date={end_date}", headers=HEADERS
    )
    assert res.status_code == 200
    data = res.json()
    assert data["income"] == 5000.0
    assert data["burn_rate"] == 700.0
    assert "savings_rate" in data


@pytest.mark.asyncio
async def test_api_get_categories(client, analytics_data):
    start_date = "2026-10-01T00:00:00Z"
    end_date = "2026-10-31T23:59:59Z"

    res = await client.get(
        f"/api/v1/analytics/categories?start_date={start_date}&end_date={end_date}", headers=HEADERS
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["name"] == "Food"
    assert data[0]["amount"] == 700.0


@pytest.mark.asyncio
async def test_api_get_top_spends(client, analytics_data):
    start_date = "2026-10-01T00:00:00Z"
    end_date = "2026-10-31T23:59:59Z"
    cat_food_id = analytics_data["cat_food"].id

    res = await client.get(
        f"/api/v1/analytics/categories/{cat_food_id}/top-spends?start_date={start_date}&end_date={end_date}&limit=1",
        headers=HEADERS,
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["merchant_name"] == "Restaurant 1"
    assert data[0]["amount"] == 500.0


@pytest.mark.asyncio
async def test_api_get_mom_variance(client, analytics_data):
    curr_start = "2026-10-01T00:00:00Z"
    curr_end = "2026-10-31T23:59:59Z"
    prev_start = "2026-09-01T00:00:00Z"
    prev_end = "2026-09-30T23:59:59Z"

    res = await client.get(
        f"/api/v1/analytics/mom-variance?current_month_start={curr_start}&current_month_end={curr_end}&prev_month_start={prev_start}&prev_month_end={prev_end}",
        headers=HEADERS,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["current_burn"] == 700.0
    assert data["prev_burn"] == 1000.0


@pytest.mark.asyncio
async def test_get_summary_metrics_zero_income(async_session, analytics_data):
    # Test period where there's no income to trigger `income > 0` condition correctly
    start_date = datetime(2027, 10, 1, tzinfo=UTC)
    end_date = datetime(2027, 10, 31, tzinfo=UTC)

    result = await AnalyticsService.get_summary_metrics(async_session, start_date, end_date)

    assert result["income"] == 0.0
    assert result["burn_rate"] == 0.0
    assert result["savings_rate"] == 0.0


@pytest.mark.asyncio
async def test_get_mom_variance_zero_prev_burn(async_session, analytics_data):
    # Test where prev month has no expenses
    curr_start = datetime(2027, 10, 1, tzinfo=UTC)
    curr_end = datetime(2027, 10, 31, tzinfo=UTC)
    prev_start = datetime(2027, 9, 1, tzinfo=UTC)
    prev_end = datetime(2027, 9, 30, tzinfo=UTC)

    result = await AnalyticsService.get_mom_variance(
        async_session, curr_start, curr_end, prev_start, prev_end
    )

    assert result["current_burn"] == 0.0
    assert result["prev_burn"] == 0.0
    assert result["variance_percentage"] == 0.0


@pytest.mark.asyncio
async def test_api_get_top_spends_invalid_limit(client, analytics_data):
    start_date = "2026-10-01T00:00:00Z"
    end_date = "2026-10-31T23:59:59Z"
    cat_food_id = analytics_data["cat_food"].id

    # Test limit < 1
    res = await client.get(
        f"/api/v1/analytics/categories/{cat_food_id}/top-spends?start_date={start_date}&end_date={end_date}&limit=0",
        headers=HEADERS,
    )
    assert res.status_code == 422

    # Test limit > 100
    res2 = await client.get(
        f"/api/v1/analytics/categories/{cat_food_id}/top-spends?start_date={start_date}&end_date={end_date}&limit=101",
        headers=HEADERS,
    )
    assert res2.status_code == 422

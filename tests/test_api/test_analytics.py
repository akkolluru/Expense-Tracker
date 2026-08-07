from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def _login():
    response = client.post("/api/auth/login", json={"username": "admin", "password": "changeme"})
    assert response.status_code == 200
    return response.cookies

def test_get_spending_summary():
    cookies = _login()
    r = client.get("/api/analytics/spending-summary?range=1M", cookies=cookies)
    assert r.status_code == 200
    data = r.json()
    assert "total_debit" in data
    assert "total_credit" in data
    assert "breakdown" in data

def test_get_categorization_stats():
    cookies = _login()
    r = client.get("/api/analytics/categorization-stats", cookies=cookies)
    assert r.status_code == 200
    data = r.json()
    assert "total_categorized" in data
    assert "stats" in data

def test_analytics_requires_auth():
    """Analytics endpoints should require authentication."""
    fresh_client = TestClient(app)
    fresh_client.cookies.clear()
    r = fresh_client.get("/api/analytics/spending-summary")
    assert r.status_code == 401

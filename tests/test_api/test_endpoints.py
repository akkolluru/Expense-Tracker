from fastapi.testclient import TestClient
import pytest
from app.main import app
from app.schemas.auth import LoginRequest

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_login_and_get_me():
    # Login
    response = client.post("/api/auth/login", json={"username": "admin", "password": "changeme"})
    assert response.status_code == 200
    assert "session_id" in response.cookies
    
    # Get Me
    response_me = client.get("/api/auth/me", cookies=response.cookies)
    assert response_me.status_code == 200
    assert response_me.json()["username"] == "admin"
    
    return response.cookies

def test_categories_api():
    cookies = test_login_and_get_me()
    
    # List categories
    response = client.get("/api/categories/", cookies=cookies)
    assert response.status_code == 200
    categories = response.json()
    assert isinstance(categories, list)
    assert len(categories) > 0  # Should be seeded
    
    # Create category
    new_cat = {"name": "Test Category", "icon": "🧪", "is_active": True}
    response = client.post("/api/categories/", json=new_cat, cookies=cookies)
    assert response.status_code == 200
    cat_data = response.json()
    assert cat_data["name"] == "Test Category"
    
    # Update category
    cat_id = cat_data["id"]
    update_cat = {"name": "Test Category Updated"}
    response = client.put(f"/api/categories/{cat_id}", json=update_cat, cookies=cookies)
    assert response.status_code == 200
    assert response.json()["name"] == "Test Category Updated"
    
    # Delete category
    response = client.delete(f"/api/categories/{cat_id}", cookies=cookies)
    assert response.status_code == 200

def test_transactions_api():
    cookies = test_login_and_get_me()
    
    # Create transaction
    new_txn = {
        "amount": 100.5,
        "direction": "debit",
        "timestamp": "2026-08-05T10:00:00Z",
        "txn_type": "upi",
        "source": "manual"
    }
    response = client.post("/api/transactions/", json=new_txn, cookies=cookies)
    assert response.status_code == 200
    txn_data = response.json()
    assert txn_data["amount"] == 100.5
    txn_id = txn_data["id"]
    
    # List transactions
    response = client.get("/api/transactions/", cookies=cookies)
    assert response.status_code == 200
    
    # Update transaction
    response = client.put(f"/api/transactions/{txn_id}", json={"amount": 200.0}, cookies=cookies)
    assert response.status_code == 200
    assert response.json()["amount"] == 200.0
    
    # Delete transaction
    response = client.delete(f"/api/transactions/{txn_id}", cookies=cookies)
    assert response.status_code == 200

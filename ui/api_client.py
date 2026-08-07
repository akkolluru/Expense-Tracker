import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

class APIClient:
    """Async HTTP client for communicating with the local FastAPI backend."""
    def __init__(self, base_url: str = "http://127.0.0.1:8000/api"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(base_url=self.base_url, follow_redirects=True)
        self.is_authenticated = False
        
    async def login(self, username: str, password: str) -> bool:
        """Attempt to log in and set the session cookie."""
        try:
            response = await self.client.post("/auth/login", json={"username": username, "password": password})
            if response.status_code == 200:
                self.is_authenticated = True
                return True
            return False
        except Exception as e:
            logger.error(f"Login failed: {e}")
            return False
            
    async def logout(self):
        """Log out and clear session."""
        try:
            await self.client.post("/auth/logout")
        except Exception as e:
            logger.error(f"Logout failed: {e}")
        finally:
            self.client.cookies.clear()
            self.is_authenticated = False
            
    async def check_session(self) -> bool:
        """Check if the current session is valid."""
        try:
            response = await self.client.get("/auth/me")
            self.is_authenticated = response.status_code == 200
            return self.is_authenticated
        except Exception:
            self.is_authenticated = False
            return False

    async def get(self, endpoint: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        """Perform a GET request."""
        response = await self.client.get(endpoint, params=params)
        response.raise_for_status()
        return response.json()
        
    async def post(self, endpoint: str, json_data: dict[str, Any]) -> dict[str, Any]:
        """Perform a POST request."""
        response = await self.client.post(endpoint, json=json_data)
        response.raise_for_status()
        return response.json()
        
    async def patch(self, endpoint: str, json_data: dict[str, Any]) -> dict[str, Any]:
        """Perform a PATCH request."""
        response = await self.client.patch(endpoint, json=json_data)
        response.raise_for_status()
        return response.json()
        
    async def delete(self, endpoint: str) -> dict[str, Any]:
        """Perform a DELETE request."""
        response = await self.client.delete(endpoint)
        response.raise_for_status()
        return response.json()
        
    async def close(self):
        await self.client.aclose()

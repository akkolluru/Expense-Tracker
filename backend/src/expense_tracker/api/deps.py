import os
from collections.abc import AsyncGenerator

from fastapi import Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.database import get_engine, get_session_factory

_engine = None
_session_factory = None


def get_session_maker():
    global _engine, _session_factory
    if _session_factory is None:
        db_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///expense_tracker.db")
        _engine = get_engine(db_url)
        _session_factory = get_session_factory(_engine)
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    session_maker = get_session_maker()
    async with session_maker() as session:
        yield session


async def verify_api_key(x_api_key: str | None = Header(None, alias="X-API-Key")) -> str:
    expected_key = os.getenv("SERVER_API_KEY", "test-api-key")
    if not x_api_key or x_api_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing X-API-Key"
        )
    return x_api_key

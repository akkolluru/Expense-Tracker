import os
from typing import Any

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def init_sqlite_pragmas(engine: AsyncEngine) -> None:
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection: Any, connection_record: Any) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode = WAL;")
        cursor.execute("PRAGMA foreign_keys = ON;")
        cursor.execute("PRAGMA busy_timeout = 5000;")
        cursor.close()


def get_engine(database_url: str = "sqlite+aiosqlite:///expense_tracker.db") -> AsyncEngine:
    engine = create_async_engine(database_url, echo=False)
    init_sqlite_pragmas(engine)
    return engine


def get_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


def get_session_maker() -> async_sessionmaker[AsyncSession]:
    global _engine, _session_factory
    if _session_factory is None:
        db_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///expense_tracker.db")
        _engine = get_engine(db_url)
        _session_factory = get_session_factory(_engine)
    return _session_factory


def reset_session_maker() -> None:
    global _engine, _session_factory
    _engine = None
    _session_factory = None

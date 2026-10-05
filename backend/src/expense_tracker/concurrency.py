import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

# Process-level asynchronous mutex for SQLite write operations & VACUUM snapshots
_db_write_lock = asyncio.Lock()


def get_db_write_lock() -> asyncio.Lock:
    """Return the global database write lock."""
    return _db_write_lock


@asynccontextmanager
async def db_write_lock() -> AsyncIterator[None]:
    """
    Context manager that acquires the database write lock.
    Ensures that heavy operations (like VACUUM INTO snapshots or batch ingestion)
    do not cause lock contention ('database is locked') with concurrent writes.
    """
    async with _db_write_lock:
        yield

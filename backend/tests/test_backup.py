import os
import time
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.api.app import create_app
from expense_tracker.api.deps import get_db
from expense_tracker.concurrency import db_write_lock, get_db_write_lock
from expense_tracker.services.backup import BackupService


@pytest.mark.asyncio
async def test_db_write_lock_acquisition() -> None:
    lock = get_db_write_lock()
    assert not lock.locked()

    async with db_write_lock():
        assert lock.locked()

    assert not lock.locked()


@pytest.mark.asyncio
async def test_create_backup_creates_valid_sqlite_file(
    async_session: AsyncSession, tmp_path: Path
) -> None:
    # Seed a table row
    await async_session.execute(
        text("CREATE TABLE IF NOT EXISTS test_items (id INTEGER PRIMARY KEY, name TEXT);")
    )
    await async_session.execute(text("INSERT INTO test_items (name) VALUES ('wallet');"))
    await async_session.commit()

    backup_dir = tmp_path / "backups"
    result = await BackupService.create_backup(
        session=async_session, backup_dir=backup_dir, retention_days=30
    )

    assert result.backup_file.endswith(".db")
    assert Path(result.backup_file).exists()
    assert result.size_bytes > 0
    assert result.timestamp is not None


@pytest.mark.asyncio
async def test_backup_rotation(tmp_path: Path) -> None:
    backup_dir = tmp_path / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)

    # Create 5 dummy backup files: files 0..4, each 1 hour apart (all within last 5 hours)
    now = time.time()
    for i in range(5):
        f = backup_dir / f"expense_tracker_2026100{i}_120000.db"
        f.write_text("test")
        mtime = now - (4 - i) * 3600  # i=4 is newest (now), i=0 is oldest (4h ago)
        os.utime(f, (mtime, mtime))

    # Rotate keeping at most max_backups=2
    deleted = BackupService.rotate_backups(backup_dir, retention_days=30, max_backups=2)

    remaining = sorted(backup_dir.glob("expense_tracker_*.db"))
    # The newest 2 should remain
    assert len(remaining) == 2
    assert len(deleted) == 3



@pytest.mark.asyncio
async def test_system_backup_endpoint(async_session: AsyncSession, tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("BACKUP_DIR", str(tmp_path / "api_backups"))
    monkeypatch.setenv("SERVER_API_KEY", "test-api-key")

    app = create_app()

    async def override_get_db():
        yield async_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/system/backup",
            headers={"X-API-Key": "test-api-key"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "SUCCESS"
        assert Path(data["backup_file"]).exists()
        assert data["size_bytes"] > 0

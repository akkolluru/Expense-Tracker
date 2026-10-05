import logging
import os
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.concurrency import db_write_lock

logger = logging.getLogger(__name__)


@dataclass
class BackupResult:
    backup_file: str
    size_bytes: int
    timestamp: datetime


class BackupService:
    @classmethod
    def get_default_backup_dir(cls) -> Path:
        env_dir = os.getenv("BACKUP_DIR")
        if env_dir:
            return Path(env_dir)
        return Path("./backups")

    @classmethod
    async def create_backup(
        cls,
        session: AsyncSession,
        backup_dir: Path | str | None = None,
        retention_days: int = 30,
    ) -> BackupResult:
        """
        Creates a zero-downtime, point-in-time snapshot of the SQLite database
        using the native SQLite VACUUM INTO command.
        Acquires the process-level SQLite write lock during execution to prevent
        lock contention ('database is locked') with concurrent writers.
        """
        target_dir = Path(backup_dir) if backup_dir else cls.get_default_backup_dir()
        target_dir.mkdir(parents=True, exist_ok=True)

        now = datetime.now(UTC)
        timestamp_str = now.strftime("%Y%m%d_%H%M%S")
        backup_filename = f"expense_tracker_{timestamp_str}.db"
        backup_path = target_dir / backup_filename

        # Sanitize single quotes in path for SQL string literal
        escaped_path = str(backup_path.resolve()).replace("'", "''")

        logger.info("Initiating SQLite VACUUM INTO snapshot to %s", backup_path)

        async with db_write_lock():
            # VACUUM INTO creates a new, defragmented database snapshot file
            await session.execute(text(f"VACUUM INTO '{escaped_path}'"))

        if not backup_path.exists():
            raise RuntimeError(f"Backup file was not created at {backup_path}")

        size_bytes = backup_path.stat().st_size
        logger.info(
            "SQLite backup created successfully: %s (%d bytes)", backup_path, size_bytes
        )

        # Rotate old backups
        cls.rotate_backups(target_dir, retention_days=retention_days)

        return BackupResult(
            backup_file=str(backup_path.resolve()),
            size_bytes=size_bytes,
            timestamp=now,
        )

    @classmethod
    def rotate_backups(
        cls, backup_dir: Path, retention_days: int = 30, max_backups: int = 30
    ) -> list[str]:
        """
        Prunes backups exceeding retention limits.
        Keeps up to max_backups most recent backups, and removes files older than retention_days.
        Ensures at least the single most recent backup is always preserved.
        """
        if not backup_dir.exists():
            return []

        backup_files = sorted(
            backup_dir.glob("expense_tracker_*.db"),
            key=lambda f: f.stat().st_mtime,
            reverse=True,
        )

        if not backup_files:
            return []

        deleted_files: list[str] = []
        now_ts = datetime.now(UTC).timestamp()
        cutoff_ts = now_ts - timedelta(days=retention_days).total_seconds()

        for index, file_path in enumerate(backup_files):
            # Always preserve the most recent backup
            if index == 0:
                continue

            file_mtime = file_path.stat().st_mtime
            # Prune if beyond max_backups count OR older than retention cutoff
            if index >= max_backups or file_mtime < cutoff_ts:
                try:
                    file_path.unlink()
                    deleted_files.append(str(file_path))
                    logger.info("Rotated and deleted old backup: %s", file_path)
                except Exception as e:  # noqa: BLE001
                    logger.warning("Failed to delete expired backup %s: %s", file_path, e)

        return deleted_files


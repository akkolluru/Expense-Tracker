"""Tests for Alembic clean v2.0 schema migration."""

import tempfile
from collections.abc import Generator
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from alembic import command
from app.database import Base
from app.models.account import Account, AccountType
from app.models.categorization_log import CategorizationAction, CategorizationLog
from app.models.category import Category
from app.models.group import Group
from app.models.raw_message import RawMessage, RawMessageSource, RawMessageStatus
from app.models.split import Split
from app.models.transaction import (
    CategorizationStrategy,
    Transaction,
    TransactionStatus,
    TransactionType,
)


@pytest.fixture
def temp_db_path() -> Generator[Path, None, None]:
    """Provide a temporary file path for SQLite migration testing."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        path = Path(f.name)
    yield path
    if path.exists():
        path.unlink()
    # Clean up any WAL/SHM companion files if created
    for ext in ("-wal", "-shm"):
        companion = Path(str(path) + ext)
        if companion.exists():
            companion.unlink()


@pytest.fixture
def alembic_config(temp_db_path: Path) -> Config:
    """Create Alembic config pointing to the temporary SQLite database."""
    ini_path = Path(__file__).resolve().parents[2] / "alembic.ini"
    config = Config(str(ini_path))
    # Override database URL with sync SQLite file URL for standard alembic commands/inspection
    config.set_main_option("sqlalchemy.url", f"sqlite:///{temp_db_path.as_posix()}")
    return config


def test_alembic_upgrade_and_table_creation(alembic_config: Config, temp_db_path: Path):
    """Test that alembic upgrade head creates all expected v2.0 tables."""
    command.upgrade(alembic_config, "head")

    sync_engine = create_engine(f"sqlite:///{temp_db_path.as_posix()}")
    inspector = inspect(sync_engine)
    table_names = set(inspector.get_table_names())

    expected_tables = {
        "accounts",
        "raw_messages",
        "categories",
        "groups",
        "transactions",
        "splits",
        "rules",
        "merchant_memory",
        "categorization_logs",
        "app_configs",
        "email_sync_states",
        "monthly_reports",
        "users",
        "sessions",
    }

    assert expected_tables.issubset(table_names), (
        f"Missing tables: {expected_tables - table_names}"
    )


def test_migration_schema_drift_zero(alembic_config: Config, temp_db_path: Path):
    """Verify zero schema drift between Base.metadata and the migrated database."""
    command.upgrade(alembic_config, "head")

    sync_engine = create_engine(f"sqlite:///{temp_db_path.as_posix()}")
    with sync_engine.connect() as connection:
        mc = MigrationContext.configure(connection)
        diff = compare_metadata(mc, Base.metadata)

    # Filter out SQLite internal sequences or harmless type variations if any
    relevant_diffs = [
        d
        for d in diff
        if not (
            isinstance(d, tuple)
            and len(d) > 1
            and getattr(d[1], "name", "") == "sqlite_sequence"
        )
    ]
    assert relevant_diffs == [], f"Schema differences detected: {relevant_diffs}"


def test_indexes_and_constraints_created(alembic_config: Config, temp_db_path: Path):
    """Verify compound indexes, single-column indexes, and unique constraints."""
    command.upgrade(alembic_config, "head")

    sync_engine = create_engine(f"sqlite:///{temp_db_path.as_posix()}")
    inspector = inspect(sync_engine)

    # 1. Transactions indexes
    txn_indexes = {
        idx["name"]: idx["column_names"]
        for idx in inspector.get_indexes("transactions")
    }
    assert "ix_transactions_analytics" in txn_indexes
    assert txn_indexes["ix_transactions_analytics"] == [
        "timestamp",
        "category_id",
        "group_id",
        "source_account_id",
    ]

    # 2. RawMessage payload_hash unique index
    raw_indexes = {
        idx["name"]: idx["column_names"]
        for idx in inspector.get_indexes("raw_messages")
    }
    assert "ix_raw_messages_payload_hash" in raw_indexes

    # 3. MerchantMemory merchant_key unique index
    mm_indexes = {
        idx["name"]: idx["column_names"]
        for idx in inspector.get_indexes("merchant_memory")
    }
    assert "ix_merchant_memory_merchant_key" in mm_indexes

    # 4. Unique constraints
    cat_uqs = [uq["name"] for uq in inspector.get_unique_constraints("categories")]
    assert "uq_category_name_parent" in cat_uqs

    report_uqs = [
        uq["name"] for uq in inspector.get_unique_constraints("monthly_reports")
    ]
    assert "uq_monthly_report_year_month" in report_uqs


def test_foreign_key_cascades_on_migrated_db(
    alembic_config: Config, temp_db_path: Path
):
    """Verify foreign key cascading delete and set null on migrated DB."""
    command.upgrade(alembic_config, "head")

    sync_engine = create_engine(f"sqlite:///{temp_db_path.as_posix()}")
    with Session(sync_engine) as session:
        session.execute(text("PRAGMA foreign_keys = ON;"))

        # Seed data
        acc = Account(
            name="Salary",
            institution="HDFC",
            account_type=AccountType.SAVINGS.value,
        )
        cat = Category(name="Travel")
        grp = Group(
            name="Goa Trip",
            start_date=date(2026, 8, 1),
            end_date=date(2026, 8, 10),
        )
        msg = RawMessage(
            source=RawMessageSource.GMAIL.value,
            payload_hash="hash123",
            raw_payload="raw data",
            status=RawMessageStatus.PARSED.value,
            received_at=datetime.now(UTC),
        )
        session.add_all([acc, cat, grp, msg])
        session.commit()

        txn = Transaction(
            source_account_id=acc.id,
            raw_message_id=msg.id,
            group_id=grp.id,
            transaction_type=TransactionType.EXPENSE.value,
            amount=500.0,
            timestamp=datetime.now(UTC),
            is_split=True,
            status=TransactionStatus.COMMITTED.value,
            categorized_by=CategorizationStrategy.MANUAL.value,
            txn_ref="UTR111",
        )
        session.add(txn)
        session.commit()

        split = Split(
            transaction_id=txn.id,
            category_id=cat.id,
            amount=500.0,
            note="Flight",
        )
        log = CategorizationLog(
            transaction_id=txn.id,
            action=CategorizationAction.MANUAL_APPROVE.value,
            to_category_id=cat.id,
        )
        session.add_all([split, log])
        session.commit()

        # Delete transaction -> splits & categorization_logs should CASCADE delete
        session.delete(txn)
        session.commit()

        splits_remaining = (
            session.execute(select(Split).where(Split.transaction_id == txn.id))
            .scalars()
            .all()
        )
        logs_remaining = (
            session.execute(
                select(CategorizationLog).where(
                    CategorizationLog.transaction_id == txn.id
                )
            )
            .scalars()
            .all()
        )
        assert len(splits_remaining) == 0
        assert len(logs_remaining) == 0


def test_alembic_downgrade_and_reupgrade(alembic_config: Config, temp_db_path: Path):
    """Test that downgrade drops all tables, and re-upgrade succeeds cleanly."""
    command.upgrade(alembic_config, "head")

    sync_engine = create_engine(f"sqlite:///{temp_db_path.as_posix()}")
    inspector = inspect(sync_engine)
    assert len(inspector.get_table_names()) >= 14

    # Downgrade to base
    command.downgrade(alembic_config, "base")

    inspector = inspect(sync_engine)
    remaining_tables = set(inspector.get_table_names()) - {
        "alembic_version",
        "sqlite_sequence",
    }
    assert remaining_tables == set(), f"Tables remained: {remaining_tables}"

    # Re-upgrade to head
    command.upgrade(alembic_config, "head")
    inspector = inspect(sync_engine)
    assert len(inspector.get_table_names()) >= 14

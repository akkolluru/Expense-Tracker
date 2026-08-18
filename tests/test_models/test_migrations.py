"""Tests for Alembic clean v2.0 schema migration."""

import tempfile
from collections.abc import Generator
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy import Engine, create_engine, inspect, select, text
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
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as temporary_file:
        path = Path(temporary_file.name)
    yield path
    if path.exists():
        path.unlink()
    # Clean up any WAL/SHM companion files if created
    for extension in ("-wal", "-shm"):
        companion_file = Path(str(path) + extension)
        if companion_file.exists():
            companion_file.unlink()


@pytest.fixture
def alembic_config(temp_db_path: Path) -> Config:
    """Create Alembic config pointing to the temporary SQLite database."""
    ini_path = Path(__file__).resolve().parents[2] / "alembic.ini"
    config = Config(str(ini_path))
    # Override database URL with sync SQLite file URL for standard alembic commands/inspection
    config.set_main_option("sqlalchemy.url", f"sqlite:///{temp_db_path.as_posix()}")
    return config


@pytest.fixture
def migrated_engine(
    alembic_config: Config, temp_db_path: Path
) -> Generator[Engine, None, None]:
    """Provide a synchronous SQLAlchemy Engine bound to an upgraded database."""
    command.upgrade(alembic_config, "head")
    engine = create_engine(f"sqlite:///{temp_db_path.as_posix()}")
    yield engine
    engine.dispose()


def test_alembic_upgrade_and_table_creation(migrated_engine: Engine):
    """Test that alembic upgrade head creates all expected v2.0 tables."""
    inspector = inspect(migrated_engine)
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


def test_migration_schema_drift_zero(migrated_engine: Engine):
    """Verify zero schema drift between Base.metadata and the migrated database."""
    with migrated_engine.connect() as connection:
        migration_context = MigrationContext.configure(connection)
        discrepancies = compare_metadata(migration_context, Base.metadata)

    # Filter out SQLite internal sequences or harmless type variations if any
    relevant_discrepancies = [
        discrepancy
        for discrepancy in discrepancies
        if not (
            isinstance(discrepancy, tuple)
            and len(discrepancy) > 1
            and getattr(discrepancy[1], "name", "") == "sqlite_sequence"
        )
    ]
    assert relevant_discrepancies == [], (
        f"Schema differences detected: {relevant_discrepancies}"
    )


def test_indexes_and_constraints_created(migrated_engine: Engine):
    """Verify compound indexes, single-column indexes, and unique constraints."""
    inspector = inspect(migrated_engine)

    # 1. Transactions indexes
    transaction_indexes = {
        index_info["name"]: index_info["column_names"]
        for index_info in inspector.get_indexes("transactions")
    }
    assert "ix_transactions_analytics" in transaction_indexes
    assert transaction_indexes["ix_transactions_analytics"] == [
        "timestamp",
        "category_id",
        "group_id",
        "source_account_id",
    ]

    # 2. RawMessage payload_hash unique index
    raw_message_indexes = {
        index_info["name"]: index_info["column_names"]
        for index_info in inspector.get_indexes("raw_messages")
    }
    assert "ix_raw_messages_payload_hash" in raw_message_indexes

    # 3. MerchantMemory merchant_key unique index
    merchant_memory_indexes = {
        index_info["name"]: index_info["column_names"]
        for index_info in inspector.get_indexes("merchant_memory")
    }
    assert "ix_merchant_memory_merchant_key" in merchant_memory_indexes

    # 4. Unique constraints
    category_unique_constraints = [
        constraint["name"]
        for constraint in inspector.get_unique_constraints("categories")
    ]
    assert "uq_category_name_parent" in category_unique_constraints

    report_unique_constraints = [
        constraint["name"]
        for constraint in inspector.get_unique_constraints("monthly_reports")
    ]
    assert "uq_monthly_report_year_month" in report_unique_constraints


def test_foreign_key_cascades_and_set_null_on_migrated_db(
    migrated_engine: Engine,
):
    """Verify foreign key cascading delete on splits/logs and SET NULL on group_id."""
    with Session(migrated_engine) as session:
        session.execute(text("PRAGMA foreign_keys = ON;"))

        # Seed initial records
        account = Account(
            name="Salary",
            institution="HDFC",
            account_type=AccountType.SAVINGS.value,
        )
        category = Category(name="Travel")
        event_group = Group(
            name="Goa Trip",
            start_date=date(2026, 8, 1),
            end_date=date(2026, 8, 10),
        )
        raw_message = RawMessage(
            source=RawMessageSource.GMAIL.value,
            payload_hash="hash123",
            raw_payload="raw data",
            status=RawMessageStatus.PARSED.value,
            received_at=datetime.now(UTC),
        )
        session.add_all([account, category, event_group, raw_message])
        session.commit()

        transaction = Transaction(
            source_account_id=account.id,
            raw_message_id=raw_message.id,
            group_id=event_group.id,
            transaction_type=TransactionType.EXPENSE.value,
            amount=500.0,
            timestamp=datetime.now(UTC),
            is_split=True,
            status=TransactionStatus.COMMITTED.value,
            categorized_by=CategorizationStrategy.MANUAL.value,
            txn_ref="UTR111",
        )
        session.add(transaction)
        session.commit()

        split = Split(
            transaction_id=transaction.id,
            category_id=category.id,
            amount=500.0,
            note="Flight",
        )
        categorization_log = CategorizationLog(
            transaction_id=transaction.id,
            action=CategorizationAction.MANUAL_APPROVE.value,
            to_category_id=category.id,
        )
        session.add_all([split, categorization_log])
        session.commit()

        # 1. Test SET NULL behavior on transaction.group_id when Group is deleted
        session.delete(event_group)
        session.commit()
        session.refresh(transaction)
        assert transaction.group_id is None

        # 2. Test CASCADE delete behavior on Split and CategorizationLog when Transaction is deleted
        session.delete(transaction)
        session.commit()

        splits_remaining = (
            session.execute(select(Split).where(Split.transaction_id == transaction.id))
            .scalars()
            .all()
        )
        logs_remaining = (
            session.execute(
                select(CategorizationLog).where(
                    CategorizationLog.transaction_id == transaction.id
                )
            )
            .scalars()
            .all()
        )
        assert len(splits_remaining) == 0
        assert len(logs_remaining) == 0


def test_alembic_downgrade_and_reupgrade(
    alembic_config: Config, migrated_engine: Engine
):
    """Test that downgrade drops all tables, and re-upgrade succeeds cleanly."""
    inspector = inspect(migrated_engine)
    assert len(inspector.get_table_names()) >= 14

    # Downgrade to base
    command.downgrade(alembic_config, "base")

    inspector = inspect(migrated_engine)
    remaining_tables = set(inspector.get_table_names()) - {
        "alembic_version",
        "sqlite_sequence",
    }
    assert remaining_tables == set(), f"Tables remained: {remaining_tables}"

    # Re-upgrade to head
    command.upgrade(alembic_config, "head")
    inspector = inspect(migrated_engine)
    assert len(inspector.get_table_names()) >= 14


def test_async_sqlite_migration_execution(temp_db_path: Path):
    """Test running Alembic migration with an async SQLite URL."""
    ini_path = Path(__file__).resolve().parents[2] / "alembic.ini"
    async_config = Config(str(ini_path))
    async_config.set_main_option(
        "sqlalchemy.url", f"sqlite+aiosqlite:///{temp_db_path.as_posix()}"
    )

    # Run upgrade using async path
    command.upgrade(async_config, "head")

    sync_engine = create_engine(f"sqlite:///{temp_db_path.as_posix()}")
    inspector = inspect(sync_engine)
    assert len(inspector.get_table_names()) >= 14
    sync_engine.dispose()

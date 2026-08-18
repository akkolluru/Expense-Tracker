"""Initial v2.0 schema migration

Revision ID: 084fd4d31952
Revises:
Create Date: 2026-08-18 11:15:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "084fd4d31952"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. App configs table
    op.create_table(
        "app_configs",
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("key"),
    )

    # 2. Categories table
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("icon", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["parent_id"], ["categories.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", "parent_id", name="uq_category_name_parent"),
    )

    # 3. Email sync states table
    op.create_table(
        "email_sync_states",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("last_history_id", sa.String(), nullable=True),
        sa.Column("last_poll_at", sa.DateTime(), nullable=True),
        sa.Column(
            "total_emails_processed",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.CheckConstraint("id = 1", name="chk_email_sync_state_id"),
        sa.PrimaryKeyConstraint("id"),
    )

    # 4. Monthly reports table
    op.create_table(
        "monthly_reports",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("total_spent", sa.Float(), nullable=False),
        sa.Column("total_income", sa.Float(), nullable=False),
        sa.Column("prev_month_spent", sa.Float(), nullable=True),
        sa.Column("prev_month_income", sa.Float(), nullable=True),
        sa.Column("spending_change_pct", sa.Float(), nullable=True),
        sa.Column("category_breakdown", sa.String(), nullable=True),
        sa.Column("weekly_trend", sa.String(), nullable=True),
        sa.Column(
            "generated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("year", "month", name="uq_monthly_report_year_month"),
    )

    # 5. Users table
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )

    # 6. Sessions table
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # 7. Accounts table
    op.create_table(
        "accounts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("institution", sa.String(length=100), nullable=False),
        sa.Column("account_type", sa.String(length=50), nullable=False),
        sa.Column("account_identifier", sa.String(length=50), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("current_balance", sa.Float(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_ignored", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 8. Raw messages table
    op.create_table(
        "raw_messages",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("external_message_id", sa.String(length=255), nullable=True),
        sa.Column("payload_hash", sa.String(length=64), nullable=False),
        sa.Column("raw_headers", sa.Text(), nullable=True),
        sa.Column("raw_payload", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("parse_error", sa.Text(), nullable=True),
        sa.Column("received_at", sa.DateTime(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_raw_messages_external_message_id"),
        "raw_messages",
        ["external_message_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_raw_messages_payload_hash"),
        "raw_messages",
        ["payload_hash"],
        unique=True,
    )

    # 9. Groups table
    op.create_table(
        "groups",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("budget", sa.Float(), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 10. Transactions table
    op.create_table(
        "transactions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("source_account_id", sa.String(length=36), nullable=True),
        sa.Column("destination_account_id", sa.String(length=36), nullable=True),
        sa.Column("raw_message_id", sa.String(length=36), nullable=True),
        sa.Column("transaction_type", sa.String(length=50), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.Column("vpa", sa.String(length=255), nullable=True),
        sa.Column("merchant_name", sa.String(length=255), nullable=True),
        sa.Column("raw_merchant_name", sa.String(length=255), nullable=True),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("sub_category_id", sa.Integer(), nullable=True),
        sa.Column("is_split", sa.Boolean(), nullable=False),
        sa.Column("group_id", sa.String(length=36), nullable=True),
        sa.Column("is_group_locked", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("categorized_by", sa.String(length=50), nullable=True),
        sa.Column("txn_ref", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["sub_category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["destination_account_id"], ["accounts.id"]),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["raw_message_id"], ["raw_messages.id"]),
        sa.ForeignKeyConstraint(["source_account_id"], ["accounts.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("txn_ref"),
    )
    op.create_index(
        op.f("ix_transactions_category_id"),
        "transactions",
        ["category_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transactions_destination_account_id"),
        "transactions",
        ["destination_account_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transactions_group_id"),
        "transactions",
        ["group_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transactions_raw_message_id"),
        "transactions",
        ["raw_message_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transactions_source_account_id"),
        "transactions",
        ["source_account_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transactions_status"),
        "transactions",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transactions_timestamp"),
        "transactions",
        ["timestamp"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transactions_transaction_type"),
        "transactions",
        ["transaction_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transactions_vpa"),
        "transactions",
        ["vpa"],
        unique=False,
    )
    op.create_index(
        "ix_transactions_timestamp_desc",
        "transactions",
        [sa.literal_column("timestamp DESC")],
        unique=False,
    )
    op.create_index(
        "ix_transactions_analytics",
        "transactions",
        ["timestamp", "category_id", "group_id", "source_account_id"],
        unique=False,
    )

    # 11. Splits table
    op.create_table(
        "splits",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("transaction_id", sa.String(length=36), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("sub_category_id", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("note", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["sub_category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(
            ["transaction_id"], ["transactions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_splits_transaction_id"),
        "splits",
        ["transaction_id"],
        unique=False,
    )

    # 12. Rules table
    op.create_table(
        "rules",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("rule_type", sa.String(length=50), nullable=False),
        sa.Column("pattern", sa.String(length=255), nullable=False),
        sa.Column("target_category_id", sa.Integer(), nullable=True),
        sa.Column("target_sub_category_id", sa.Integer(), nullable=True),
        sa.Column("target_group_id", sa.String(length=36), nullable=True),
        sa.Column("is_transfer", sa.Boolean(), nullable=False),
        sa.Column("transfer_dest_account_id", sa.String(length=36), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("hit_count", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["target_category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["target_sub_category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["target_group_id"], ["groups.id"]),
        sa.ForeignKeyConstraint(["transfer_dest_account_id"], ["accounts.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # 13. Merchant memory table
    op.create_table(
        "merchant_memory",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("merchant_key", sa.String(length=255), nullable=False),
        sa.Column("key_type", sa.String(length=50), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("sub_category_id", sa.Integer(), nullable=True),
        sa.Column("hit_count", sa.Integer(), nullable=False),
        sa.Column(
            "last_used_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["sub_category_id"], ["categories.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_merchant_memory_merchant_key"),
        "merchant_memory",
        ["merchant_key"],
        unique=True,
    )

    # 14. Categorization logs table
    op.create_table(
        "categorization_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("transaction_id", sa.String(length=36), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("from_category_id", sa.Integer(), nullable=True),
        sa.Column("from_sub_category_id", sa.Integer(), nullable=True),
        sa.Column("to_category_id", sa.Integer(), nullable=True),
        sa.Column("to_sub_category_id", sa.Integer(), nullable=True),
        sa.Column("strategy", sa.String(length=50), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("llm_response_raw", sa.Text(), nullable=True),
        sa.Column("llm_inference_time_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["from_category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["from_sub_category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["to_category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["to_sub_category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(
            ["transaction_id"], ["transactions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_categorization_logs_transaction_id"),
        "categorization_logs",
        ["transaction_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_categorization_logs_transaction_id"),
        table_name="categorization_logs",
    )
    op.drop_table("categorization_logs")

    op.drop_index(op.f("ix_merchant_memory_merchant_key"), table_name="merchant_memory")
    op.drop_table("merchant_memory")

    op.drop_table("rules")

    op.drop_index(op.f("ix_splits_transaction_id"), table_name="splits")
    op.drop_table("splits")

    op.drop_index("ix_transactions_analytics", table_name="transactions")
    op.drop_index("ix_transactions_timestamp_desc", table_name="transactions")
    op.drop_index(op.f("ix_transactions_vpa"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_transaction_type"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_timestamp"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_status"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_source_account_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_raw_message_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_group_id"), table_name="transactions")
    op.drop_index(
        op.f("ix_transactions_destination_account_id"),
        table_name="transactions",
    )
    op.drop_index(op.f("ix_transactions_category_id"), table_name="transactions")
    op.drop_table("transactions")

    op.drop_table("groups")

    op.drop_index(op.f("ix_raw_messages_payload_hash"), table_name="raw_messages")
    op.drop_index(
        op.f("ix_raw_messages_external_message_id"), table_name="raw_messages"
    )
    op.drop_table("raw_messages")

    op.drop_table("accounts")
    op.drop_table("sessions")
    op.drop_table("users")
    op.drop_table("monthly_reports")
    op.drop_table("email_sync_states")
    op.drop_table("categories")
    op.drop_table("app_configs")

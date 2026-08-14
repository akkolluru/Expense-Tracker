"""Tests for the Account domain model and enum definitions."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountType


@pytest.mark.asyncio
async def test_create_account_defaults(db_session: AsyncSession):
    """Test creating an Account with minimum required fields and check defaults."""
    account = Account(
        name="HDFC Salary",
        institution="HDFC",
        account_type=AccountType.SAVINGS.value,
        account_identifier="1234",
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    assert account.id is not None
    assert len(account.id) == 36  # UUID v4 string
    assert account.name == "HDFC Salary"
    assert account.institution == "HDFC"
    assert account.account_type == "SAVINGS"
    assert account.account_identifier == "1234"
    assert account.currency == "INR"
    assert account.current_balance == 0.0
    assert account.is_active is True
    assert account.is_ignored is False
    assert account.created_at is not None
    assert account.updated_at is not None


@pytest.mark.asyncio
async def test_create_ignored_account(db_session: AsyncSession):
    """Test creating an ignored Account (suppressing notifications)."""
    account = Account(
        name="Joint Family Account",
        institution="ICICI",
        account_type=AccountType.SAVINGS.value,
        account_identifier="9876",
        is_ignored=True,
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    assert account.is_ignored is True
    assert account.is_active is True


@pytest.mark.asyncio
async def test_account_type_enum_values():
    """Verify standard AccountType enum members."""
    assert AccountType.SAVINGS.value == "SAVINGS"
    assert AccountType.CREDIT_CARD.value == "CREDIT_CARD"
    assert AccountType.CASH.value == "CASH"
    assert AccountType.INVESTMENT.value == "INVESTMENT"

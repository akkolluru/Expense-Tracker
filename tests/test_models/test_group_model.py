"""Tests for Group domain model (event/trip tracking)."""

from datetime import date

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.group import Group


@pytest.mark.asyncio
async def test_create_group(db_session: AsyncSession):
    """Test creating a Group representing a trip with a date window and budget."""
    group = Group(
        name="Goa Trip 2026",
        start_date=date(2026, 8, 10),
        end_date=date(2026, 8, 15),
        budget=25000.0,
        currency="INR",
    )
    db_session.add(group)
    await db_session.commit()
    await db_session.refresh(group)

    assert group.id is not None
    assert len(group.id) == 36
    assert group.name == "Goa Trip 2026"
    assert group.start_date == date(2026, 8, 10)
    assert group.end_date == date(2026, 8, 15)
    assert group.budget == 25000.0
    assert group.currency == "INR"
    assert group.is_active is True
    assert group.created_at is not None
    assert group.updated_at is not None

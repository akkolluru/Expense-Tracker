"""Tests for the Category domain model, hierarchy, and unique constraints."""

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.category import Category


@pytest.mark.asyncio
async def test_create_category_hierarchy(db_session: AsyncSession):
    """Test parent category and child subcategories hierarchy."""
    parent = Category(name="Food", icon="🍔", is_active=True)
    db_session.add(parent)
    await db_session.commit()
    await db_session.refresh(parent)

    assert parent.id is not None
    assert parent.parent_id is None

    sub1 = Category(name="Dining Out", parent_id=parent.id, icon="🍽️")
    sub2 = Category(name="Groceries", parent_id=parent.id, icon="🛒")
    db_session.add_all([sub1, sub2])
    await db_session.commit()

    stmt = (
        select(Category)
        .where(Category.id == parent.id)
        .options(selectinload(Category.children))
    )
    result = await db_session.execute(stmt)
    loaded_parent = result.scalar_one()

    assert len(loaded_parent.children) == 2
    child_names = {c.name for c in loaded_parent.children}
    assert child_names == {"Dining Out", "Groceries"}


@pytest.mark.asyncio
async def test_category_unique_constraint(db_session: AsyncSession):
    """Test uniqueness of category name under the same parent."""
    parent = Category(name="Utilities")
    db_session.add(parent)
    await db_session.commit()

    sub1 = Category(name="Electricity", parent_id=parent.id)
    db_session.add(sub1)
    await db_session.commit()

    # Attempt duplicate under same parent
    dup_sub = Category(name="Electricity", parent_id=parent.id)
    db_session.add(dup_sub)
    with pytest.raises(IntegrityError):
        await db_session.commit()

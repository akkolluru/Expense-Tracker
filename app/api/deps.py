import datetime
from typing import AsyncGenerator
from fastapi import Request, Depends, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.session import Session as DBSession
from app.core.exceptions import AuthenticationError

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async for db in get_db():
        yield db

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db_session)
) -> User:
    """
    Extracts session_id from the cookie, verifies it, and returns the User.
    Throws AuthenticationError if session is missing, invalid, or expired.
    """
    session_id = request.cookies.get("session_id")
    if not session_id:
        raise AuthenticationError("Not authenticated")
        
    result = await db.execute(
        select(DBSession).where(DBSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise AuthenticationError("Invalid session")
        
    if session.expires_at < datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None):
        # Session expired, we could delete it here
        await db.delete(session)
        await db.commit()
        raise AuthenticationError("Session expired")
        
    # Get the user
    user_result = await db.execute(
        select(User).where(User.id == session.user_id)
    )
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise AuthenticationError("User not found")
        
    return user

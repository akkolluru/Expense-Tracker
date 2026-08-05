import datetime
from fastapi import APIRouter, Depends, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db_session, get_current_user
from app.models.user import User
from app.models.session import Session as DBSession
from app.schemas.auth import LoginRequest, LoginResponse, LogoutResponse
from app.schemas.user import UserResponse
from app.core.security import verify_password, generate_session_token
from app.core.exceptions import AuthenticationError
from app.config import get_settings

settings = get_settings()
router = APIRouter()

# We need to import the global limiter to use it in routes
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)

@router.post("/login", response_model=LoginResponse)
@limiter.limit(settings.login_rate_limit)
async def login(
    request: Request,
    response: Response,
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db_session)
):
    # 1. Fetch user by username
    user_result = await db.execute(
        select(User).where(User.username == login_data.username)
    )
    user = user_result.scalar_one_or_none()
    
    # 2. Verify user exists and password is correct
    if not user or not verify_password(login_data.password, user.password_hash):
        raise AuthenticationError("Invalid username or password")
        
    # 3. Generate session token
    session_id = generate_session_token()
    
    # 4. Create session record
    expires_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(days=settings.session_ttl_days)
    new_session = DBSession(
        id=session_id,
        user_id=user.id,
        expires_at=expires_at
    )
    db.add(new_session)
    await db.commit()
    
    # 5. Set HTTP-only cookie
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        secure=False,  # Tailscale handles TLS, local is fine
        samesite="lax",
        max_age=settings.session_ttl_days * 24 * 60 * 60,
    )
    
    return {"message": "Logged in successfully"}

@router.post("/logout", response_model=LogoutResponse)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db_session)
):
    session_id = request.cookies.get("session_id")
    if session_id:
        result = await db.execute(
            select(DBSession).where(DBSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if session:
            await db.delete(session)
            await db.commit()
            
    response.delete_cookie(key="session_id")
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.api import api_router
from app.config import get_settings
from app.core.exceptions import AppException
from app.database import init_db
from app.workers.scheduler import start_scheduler, stop_scheduler

# Configure logging at the module level
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

settings = get_settings()
limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Expense Tracker API...")
    await init_db()
    logger.info("Database initialized.")
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()
    logger.info("Shutting down Expense Tracker API...")

app = FastAPI(
    title="Expense Tracker API",
    description="Self-hosted expense tracking with hybrid AI categorization",
    version="1.0.0",
    lifespan=lifespan,
)
app.state.limiter = limiter

# CORS - restricted to Tailscale IP range
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tailscale handles network-level access control
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(api_router, prefix="/api")

# Global exception handler
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error_code": exc.error_code,
            "status_code": exc.status_code,
        },
    )

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "version": "1.0.0",
        "database": "connected",
    }

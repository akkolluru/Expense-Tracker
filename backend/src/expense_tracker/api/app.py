import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from expense_tracker.api.routes.accounts import router as accounts_router
from expense_tracker.api.routes.analytics import router as analytics_router
from expense_tracker.api.routes.categories import router as categories_router
from expense_tracker.api.routes.inbox import router as inbox_router
from expense_tracker.api.routes.sync import router as sync_router
from expense_tracker.api.routes.system import router as system_router
from expense_tracker.api.routes.transactions import router as transactions_router
from expense_tracker.workers.scheduler import app_scheduler


def _resolve_frontend_dist() -> Path | None:
    env_dir = os.getenv("FRONTEND_DIST_DIR")
    if env_dir:
        p = Path(env_dir)
        if p.exists():
            return p

    docker_path = Path("/app/frontend/dist")
    if docker_path.exists():
        return docker_path

    # Monorepo local development path
    try:
        local_path = Path(__file__).resolve().parents[4] / "frontend" / "dist"
        if local_path.exists():
            return local_path
    except IndexError:
        pass

    return None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    enable_scheduler = os.getenv("ENABLE_SCHEDULER", "1").lower() in ("1", "true", "yes")
    # In test environments, disable background scheduler by default
    if os.getenv("TESTING") == "1" or "PYTEST_CURRENT_TEST" in os.environ:
        enable_scheduler = os.getenv("ENABLE_SCHEDULER") == "1"

    if enable_scheduler:
        app_scheduler.start()

    try:
        yield
    finally:
        if enable_scheduler:
            await app_scheduler.shutdown()



def create_app() -> FastAPI:
    app = FastAPI(
        title="Expense Tracker v2.0 API",
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    cors_origins_raw = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:8550,http://127.0.0.1:5173,http://127.0.0.1:8550",
    )
    allowed_origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 1. Register API Routes
    app.include_router(accounts_router, prefix="/api/v1")
    app.include_router(categories_router, prefix="/api/v1")
    app.include_router(transactions_router, prefix="/api/v1")
    app.include_router(sync_router, prefix="/api/v1")
    app.include_router(inbox_router, prefix="/api/v1")
    app.include_router(system_router, prefix="/api/v1")
    app.include_router(analytics_router, prefix="/api/v1")

    # 2. Unified Static Asset & SPA Serving (PaisaIQ PWA)
    frontend_dist = _resolve_frontend_dist()
    if frontend_dist and (frontend_dist / "index.html").exists():
        assets_dir = frontend_dist / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str) -> Response:
            # Check for direct file match (manifest.json, favicon.svg, etc.)
            if full_path:
                candidate = (frontend_dist / full_path).resolve()
                if candidate.is_file() and str(candidate).startswith(str(frontend_dist.resolve())):
                    return FileResponse(candidate)

            # Fallback to index.html for SPA client-side routing
            return FileResponse(frontend_dist / "index.html")

    return app

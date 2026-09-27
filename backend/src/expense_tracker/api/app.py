from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from expense_tracker.api.routes.accounts import router as accounts_router
from expense_tracker.api.routes.inbox import router as inbox_router
from expense_tracker.api.routes.sync import router as sync_router
from expense_tracker.api.routes.system import router as system_router
from expense_tracker.api.routes.transactions import router as transactions_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="Expense Tracker v2.0 API",
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(accounts_router, prefix="/api/v1")
    app.include_router(transactions_router, prefix="/api/v1")
    app.include_router(sync_router, prefix="/api/v1")
    app.include_router(inbox_router, prefix="/api/v1")
    app.include_router(system_router, prefix="/api/v1")

    return app

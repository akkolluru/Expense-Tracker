from fastapi import APIRouter

from app.api.routes import analytics, auth, categories, inbox, rules, transactions

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
api_router.include_router(rules.router, prefix="/rules", tags=["rules"])
api_router.include_router(inbox.router, prefix="/inbox", tags=["inbox"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])

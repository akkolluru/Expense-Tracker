from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.api.deps import get_db, verify_api_key
from expense_tracker.api.schemas import SystemHealthResponse
from expense_tracker.services.categorization import CategorizationService

router = APIRouter(prefix="/system", tags=["System"], dependencies=[Depends(verify_api_key)])


@router.get("/health", response_model=SystemHealthResponse)
async def system_health(session: AsyncSession = Depends(get_db)) -> SystemHealthResponse:
    # 1. Probe database
    db_status = "CONNECTED"
    try:
        await session.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        db_status = "DISCONNECTED"

    # 2. Probe circuit breaker
    cb_state = CategorizationService.llm_client.circuit_breaker.state.value

    return SystemHealthResponse(
        status="HEALTHY" if db_status == "CONNECTED" else "DEGRADED",
        database=db_status,
        llm_circuit_breaker=cb_state,
        active_parsers_count=4,
        timestamp=datetime.now(UTC),
    )

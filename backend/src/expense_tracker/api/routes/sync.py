import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.api.deps import get_db, verify_api_key
from expense_tracker.api.schemas import (
    SyncParseTextRequest,
    SyncParseTextResponse,
    TransactionResponse,
)
from expense_tracker.parsers.registry import BankParserRegistry
from expense_tracker.services.reconciliation import ReconciliationService
from expense_tracker.services.staging import StagingService

router = APIRouter(prefix="/sync", tags=["Sync"], dependencies=[Depends(verify_api_key)])


@router.post("/parse-text", response_model=SyncParseTextResponse)
async def parse_text(
    payload: SyncParseTextRequest, session: AsyncSession = Depends(get_db)
) -> SyncParseTextResponse:
    # 1. Ingest into raw_messages staging
    external_id = f"manual-sync-{uuid.uuid4()}"
    raw_msg, _ = await StagingService.ingest_raw_message(
        session=session,
        source=payload.source,
        external_id=external_id,
        raw_body=payload.raw_text,
    )

    # 2. Parse using default registry
    registry = BankParserRegistry.get_default()
    drafts = registry.parse_raw_message(raw_msg)
    if not drafts:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unable to parse bank alert from provided text",
        )

    draft = drafts[0]

    # 3. Reconcile / Deduplicate / Merge
    try:
        tx, is_new = await ReconciliationService.process_draft(
            session=session,
            draft=draft,
            fallback_account_id=payload.account_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return SyncParseTextResponse(
        status="CREATED" if is_new else "MERGED",
        action="TRANSACTION_CREATED" if is_new else "ENRICHMENT_MERGE",
        transaction=TransactionResponse.model_validate(tx),
    )

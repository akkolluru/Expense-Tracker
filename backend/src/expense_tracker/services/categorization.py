from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.models.category import Category
from expense_tracker.models.rule import CategorizationLog
from expense_tracker.models.transaction import Transaction
from expense_tracker.parsers.base import DraftTransaction
from expense_tracker.services.ledger import LedgerService
from expense_tracker.services.rules import RuleEngine
from expense_tracker.services.merchant_memory import MerchantMemoryService
from expense_tracker.services.llm_client import HybridLLMClient

@dataclass
class ClassificationResult:
    category_id: int
    group_id: Optional[int] = None
    strategy: str = "MANUAL"
    confidence: float = 1.0

class CategorizationService:
    llm_client: HybridLLMClient = HybridLLMClient()

    @classmethod
    async def classify(
        cls,
        session: AsyncSession,
        draft: DraftTransaction,
    ) -> Optional[ClassificationResult]:
        # Tier 1: Deterministic Rule Engine
        rule_match = await RuleEngine.evaluate(session, draft)
        if rule_match:
            return ClassificationResult(
                category_id=rule_match.category_id,
                group_id=rule_match.group_id,
                strategy="RULE",
                confidence=1.0,
            )

        # Tier 2: Merchant Memory
        memory_match = await MerchantMemoryService.lookup(
            session,
            merchant_name=draft.merchant_name,
            merchant_vpa=draft.merchant_vpa,
        )
        if memory_match:
            return ClassificationResult(
                category_id=memory_match.category_id,
                group_id=None,
                strategy="MERCHANT_MEMORY",
                confidence=memory_match.confidence,
            )

        return None

    @classmethod
    async def process_and_record(
        cls,
        session: AsyncSession,
        draft: DraftTransaction,
        account_id: int,
    ) -> Transaction:
        # Check Tier 1 & 2
        match = await cls.classify(session, draft)

        category_id: Optional[int] = None
        suggested_category_id: Optional[int] = None
        status: str = "POSTED"
        strategy: str = "MANUAL"
        confidence: float = 1.0
        reasoning: Optional[str] = None
        raw_llm: Optional[str] = None

        if match:
            category_id = match.category_id
            status = "POSTED"
            strategy = match.strategy
            confidence = match.confidence
            reasoning = f"Matched {match.strategy}"
        else:
            # Tier 3: Hybrid LLM
            stmt = select(Category)
            res = await session.execute(stmt)
            categories = [{"id": c.id, "name": c.name} for c in res.scalars().all()]
            valid_ids = {c["id"] for c in categories}

            try:
                llm_resp, llm_strategy, raw_text = await cls.llm_client.categorize(draft, categories)
                strategy = llm_strategy
                confidence = llm_resp.confidence
                reasoning = llm_resp.reasoning
                raw_llm = raw_text

                if confidence >= 0.70 and llm_resp.category_id in valid_ids:
                    category_id = llm_resp.category_id
                    suggested_category_id = None
                    status = "POSTED"
                else:
                    # Tier 4: Review Queue
                    category_id = None
                    suggested_category_id = llm_resp.category_id
                    status = "PENDING_REVIEW"
            except Exception as e:
                category_id = None
                suggested_category_id = None
                status = "PENDING_REVIEW"
                strategy = "MANUAL"
                confidence = 0.0
                reasoning = f"LLM error: {str(e)}"

        timestamp = draft.raw_timestamp or datetime.now(timezone.utc)
        tx = await LedgerService.record_transaction(
            session=session,
            account_id=account_id,
            amount=draft.amount,
            merchant_name=draft.merchant_name,
            timestamp=timestamp,
            is_expense=draft.is_expense,
            is_transfer=draft.is_transfer,
            raw_message_id=draft.raw_message_id,
            merchant_vpa=draft.merchant_vpa,
            reference_number=draft.reference_number,
            description=draft.description,
            category_id=category_id,
            suggested_category_id=suggested_category_id,
            status=status,
            categorization_strategy=strategy,
            categorization_confidence=confidence,
        )

        log = CategorizationLog(
            transaction_id=tx.id,
            strategy_used=strategy,
            confidence=confidence,
            reasoning=reasoning,
            raw_llm_response=raw_llm,
        )
        session.add(log)
        await session.commit()
        await session.refresh(tx)
        return tx

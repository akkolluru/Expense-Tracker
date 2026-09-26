from dataclasses import dataclass
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.parsers.base import DraftTransaction
from expense_tracker.services.rules import RuleEngine
from expense_tracker.services.merchant_memory import MerchantMemoryService

@dataclass
class ClassificationResult:
    category_id: int
    group_id: Optional[int] = None
    strategy: str = "MANUAL"
    confidence: float = 1.0

class CategorizationService:
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

        # Tier 3 (LLM) / Tier 4 (PENDING_REVIEW) handled in subsequent stages
        return None

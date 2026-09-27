import fnmatch
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_tracker.models.rule import Rule
from expense_tracker.parsers.base import DraftTransaction


class RuleEngine:
    @classmethod
    async def evaluate(cls, session: AsyncSession, draft: DraftTransaction) -> Rule | None:
        """Evaluates active rules in ascending priority order."""
        stmt = select(Rule).where(Rule.is_active == True).order_by(Rule.priority.asc())
        res = await session.execute(stmt)
        rules = res.scalars().all()

        for rule in rules:
            if not cls._matches_amount(rule, draft):
                continue
            if cls._matches_pattern(rule, draft):
                return rule

        return None

    @staticmethod
    def _matches_amount(rule: Rule, draft: DraftTransaction) -> bool:
        if rule.min_amount is not None and draft.amount < rule.min_amount:
            return False
        return not (rule.max_amount is not None and draft.amount > rule.max_amount)

    @staticmethod
    def _matches_pattern(rule: Rule, draft: DraftTransaction) -> bool:
        pattern_type = rule.pattern_type.upper()
        pattern_val = rule.pattern_value.strip()

        if pattern_type == "VPA":
            if not draft.merchant_vpa:
                return False
            vpa = draft.merchant_vpa.strip().lower()
            target = pattern_val.lower()
            return fnmatch.fnmatch(vpa, target) or vpa == target

        merchant_name = draft.merchant_name.strip()

        if pattern_type == "MERCHANT_EXACT":
            return merchant_name.lower() == pattern_val.lower()

        if pattern_type == "MERCHANT_CONTAINS":
            return pattern_val.lower() in merchant_name.lower()

        if pattern_type == "REGEX":
            combined = f"{merchant_name} {draft.merchant_vpa or ''} {draft.description or ''}"
            try:
                return bool(re.search(pattern_val, combined, re.IGNORECASE))
            except re.error:
                return False

        return False

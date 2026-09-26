from datetime import datetime
from decimal import Decimal
import re
from typing import Optional

from expense_tracker.models.raw_message import RawMessage
from expense_tracker.parsers.base import DraftTransaction

def _parse_amount(raw_str: str) -> Decimal:
    return Decimal(raw_str.replace(",", "").strip())

class GenericUpiParser:
    name: str = "GenericUpiParser"
    institution: str = "GENERIC"

    def can_handle(self, raw_message: RawMessage) -> bool:
        body = raw_message.raw_body.lower()
        has_amount = "rs" in body or "inr" in body
        has_dir = "debited" in body or "credited" in body
        return has_amount and has_dir

    def parse(self, raw_message: RawMessage) -> list[DraftTransaction]:
        body = raw_message.raw_body

        pattern = (
            r"(?i)(?:Rs\.?|INR)\s*([0-9,]+(?:\.[0-9]{2})?)\s*(debited|credited)\s*"
            r"(?:from|to)?\s*(?:A\/c|Acct|Account)?\s*(?:\*+|x+)?([0-9]{3,4})?\s*"
            r"(?:to|from|towards|at)\s*([a-zA-Z0-9\s._\-@]+?)(?:\s+on|\s+ref|\.|\n|$)"
        )
        match = re.search(pattern, body)
        if not match:
            return []

        amount = _parse_amount(match.group(1))
        direction = match.group(2).lower()
        last4 = match.group(3) if match.group(3) else None
        merchant_name = match.group(4).strip()

        ref_match = re.search(r"(?i)ref(?:erence)?(?:\s*no\.?)?:?\s*([0-9]+)", body)
        ref_no = ref_match.group(1).strip() if ref_match else None

        draft = DraftTransaction(
            raw_message_id=raw_message.id,
            account_institution=self.institution,
            account_number_last4=last4,
            amount=amount,
            currency="INR",
            is_expense=(direction == "debited"),
            is_transfer=False,
            merchant_name=merchant_name,
            reference_number=ref_no,
            raw_timestamp=raw_message.received_at,
            description="Generic UPI alert"
        )
        return [draft]

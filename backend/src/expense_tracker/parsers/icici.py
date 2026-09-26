from datetime import datetime
from decimal import Decimal
import re
from typing import Optional

from expense_tracker.models.raw_message import RawMessage
from expense_tracker.parsers.base import DraftTransaction

def _parse_amount(raw_str: str) -> Decimal:
    return Decimal(raw_str.replace(",", "").strip())

class IciciAlertParser:
    name: str = "IciciAlertParser"
    institution: str = "ICICI"

    def can_handle(self, raw_message: RawMessage) -> bool:
        sender = (raw_message.sender or "").lower()
        body = raw_message.raw_body.lower()
        return "icicibank" in sender or "icici" in body

    def parse(self, raw_message: RawMessage) -> list[DraftTransaction]:
        body = raw_message.raw_body

        pattern = (
            r"(?i)Account\s+\*\*([0-9]{4})\s+is\s+(debited|credited)\s+with\s+INR\s+"
            r"([0-9,]+(?:\.[0-9]{2})?)\s+on\s+([0-9a-zA-Z\-\/ :]+)\s+towards\s+([^\.]+?)\."
            r"(?:\s*UPI\s+Ref(?:\s*No\.?)?\s*([0-9]+))?"
        )
        match = re.search(pattern, body)
        if not match:
            return []

        last4 = match.group(1)
        direction = match.group(2).lower()
        amount = _parse_amount(match.group(3))
        merchant_name = match.group(5).strip()
        ref_no = match.group(6).strip() if match.group(6) else None

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
            description="ICICI Bank alert"
        )
        return [draft]

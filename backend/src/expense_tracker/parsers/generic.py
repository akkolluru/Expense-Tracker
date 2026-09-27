import re
from decimal import Decimal

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
        has_dir = "debited" in body or "credited" in body or "spent" in body
        return has_amount and has_dir

    def parse(self, raw_message: RawMessage) -> list[DraftTransaction]:
        body = raw_message.raw_body

        # 1. Amount
        amt_match = re.search(r"(?i)(?:Rs\.?|INR)\s*([0-9,]+(?:\.[0-9]{2})?)", body)
        if not amt_match:
            return []
        amount = _parse_amount(amt_match.group(1))

        # 2. Direction
        is_expense = "credited" not in body.lower()

        # 3. Account last 4
        last4_match = re.search(
            r"(?i)(?:ending|a/c|acct|account)\s*(?:no\.?)?\s*(?:\*+|x+)?([0-9]{3,4})", body
        )
        last4 = last4_match.group(1) if last4_match else None

        # 4. Merchant & VPA
        vpa_match = re.search(
            r"(?i)(?:towards\s+VPA|VPA|to)\s+([a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+)(?:\s*\(([^)]+)\))?",
            body,
        )
        merchant_vpa: str | None = None
        merchant_name: str = "Unknown Merchant"

        if vpa_match:
            merchant_vpa = vpa_match.group(1).strip()
            if vpa_match.group(2):
                merchant_name = vpa_match.group(2).strip()
            else:
                merchant_name = merchant_vpa
        else:
            payee_match = re.search(
                r"(?i)(?:to|from|towards|at)\s+([a-zA-Z0-9\s._\-@]+?)(?:\s+on|\s+ref|\.|\n|$)", body
            )
            if payee_match:
                merchant_name = payee_match.group(1).strip()

        # 5. Reference Number / UTR
        ref_match = re.search(
            r"(?i)(?:UPI(?:\s+transaction)?\s+)?ref(?:erence)?(?:\s*no\.?)?:?\s*([0-9]+)", body
        )
        ref_no = ref_match.group(1).strip() if ref_match else None

        draft = DraftTransaction(
            raw_message_id=raw_message.id,
            account_institution=self.institution,
            account_number_last4=last4,
            amount=amount,
            currency="INR",
            is_expense=is_expense,
            is_transfer=False,
            merchant_name=merchant_name,
            merchant_vpa=merchant_vpa,
            reference_number=ref_no,
            raw_timestamp=raw_message.received_at,
            description="Generic UPI alert",
        )
        return [draft]

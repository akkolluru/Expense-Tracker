import re
from decimal import Decimal

from expense_tracker.models.raw_message import RawMessage
from expense_tracker.parsers.base import DraftTransaction


def _parse_amount(raw_str: str) -> Decimal:
    cleaned = raw_str.replace(",", "").strip()
    return Decimal(cleaned)


class HdfcUpiParser:
    name: str = "HdfcUpiParser"
    institution: str = "HDFC"

    def can_handle(self, raw_message: RawMessage) -> bool:
        sender = (raw_message.sender or "").lower()
        subject = (raw_message.subject or "").lower()
        body = raw_message.raw_body.lower()

        is_hdfc = "hdfcbank" in sender or "hdfc bank" in body
        is_upi = "upi" in subject or "upi" in body or "vpa" in body
        return is_hdfc and is_upi

    def parse(self, raw_message: RawMessage) -> list[DraftTransaction]:
        body = raw_message.raw_body

        # Amount
        amt_match = re.search(r"(?i)Rs\.?\s*([0-9,]+(?:\.[0-9]{2})?)", body)
        if not amt_match:
            return []
        amount = _parse_amount(amt_match.group(1))

        # Direction
        is_expense = "debited" in body.lower()

        # Account last 4
        last4_match = re.search(r"(?i)(?:ending|account)\s+(?:\*\*)*([0-9]{4})", body)
        last4 = last4_match.group(1) if last4_match else None

        # VPA and Merchant Name
        vpa_match = re.search(
            r"(?i)towards\s+VPA\s+([a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+)(?:\s*\(([^)]+)\))?", body
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
            # Fallback payee match
            to_match = re.search(r"(?i)(?:to|from)\s+([^\.\n]+?)(?:\s+on|\.|\n)", body)
            if to_match:
                merchant_name = to_match.group(1).strip()

        # UTR
        utr_match = re.search(
            r"(?i)UPI\s+(?:transaction\s+)?ref(?:erence)?\s*(?:no\.?)?:?\s*([0-9]+)", body
        )
        reference_number = utr_match.group(1).strip() if utr_match else None

        # Closing balance if present
        balance_match = re.search(
            r"(?i)Avail(?:able)?\s+bal(?:ance)?:?\s*Rs\.?\s*([0-9,]+(?:\.[0-9]{2})?)", body
        )
        closing_balance = _parse_amount(balance_match.group(1)) if balance_match else None

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
            reference_number=reference_number,
            raw_timestamp=raw_message.received_at,
            closing_balance=closing_balance,
            description="HDFC UPI alert",
        )
        return [draft]


class HdfcCardParser:
    name: str = "HdfcCardParser"
    institution: str = "HDFC"

    def can_handle(self, raw_message: RawMessage) -> bool:
        sender = (raw_message.sender or "").lower()
        subject = (raw_message.subject or "").lower()
        body = raw_message.raw_body.lower()

        is_hdfc = "hdfcbank" in sender or "hdfc" in body
        is_card = "card" in subject or "card" in body or "spent on your hdfc" in body
        return is_hdfc and is_card

    def parse(self, raw_message: RawMessage) -> list[DraftTransaction]:
        body = raw_message.raw_body

        pattern = (
            r"(?i)Rs\.?\s*([0-9,]+(?:\.[0-9]{2})?)\s*was spent on your HDFC Bank "
            r"(?:Credit|Debit) Card ending \*\*?([0-9]{4})\s+at\s+([^\.]+?)\s+on\s+([0-9\-\/ :]+)"
        )
        match = re.search(pattern, body)
        if not match:
            return []

        amount = _parse_amount(match.group(1))
        last4 = match.group(2)
        merchant_name = match.group(3).strip()

        draft = DraftTransaction(
            raw_message_id=raw_message.id,
            account_institution=self.institution,
            account_number_last4=last4,
            amount=amount,
            currency="INR",
            is_expense=True,
            is_transfer=False,
            merchant_name=merchant_name,
            raw_timestamp=raw_message.received_at,
            description="HDFC Card transaction",
        )
        return [draft]

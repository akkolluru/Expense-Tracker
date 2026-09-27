from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Protocol, runtime_checkable

from expense_tracker.models.raw_message import RawMessage


@dataclass
class DraftTransaction:
    raw_message_id: int
    account_institution: str
    amount: Decimal
    currency: str = "INR"
    is_expense: bool = True
    is_transfer: bool = False
    merchant_name: str = ""
    account_number_last4: str | None = None
    merchant_vpa: str | None = None
    reference_number: str | None = None
    raw_timestamp: datetime | None = None
    closing_balance: Decimal | None = None
    description: str | None = None


@runtime_checkable
class BankParser(Protocol):
    name: str
    institution: str

    def can_handle(self, raw_message: RawMessage) -> bool: ...

    def parse(self, raw_message: RawMessage) -> list[DraftTransaction]: ...

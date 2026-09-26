from typing import Optional
from expense_tracker.models.raw_message import RawMessage
from expense_tracker.parsers.base import BankParser, DraftTransaction
from expense_tracker.parsers.hdfc import HdfcUpiParser, HdfcCardParser
from expense_tracker.parsers.icici import IciciAlertParser
from expense_tracker.parsers.generic import GenericUpiParser

class BankParserRegistry:
    def __init__(self) -> None:
        self._parsers: list[BankParser] = []

    def register(self, parser: BankParser) -> None:
        self._parsers.append(parser)

    def find_parser(self, raw_message: RawMessage) -> Optional[BankParser]:
        for parser in self._parsers:
            if parser.can_handle(raw_message):
                return parser
        return None

    def parse_raw_message(self, raw_message: RawMessage) -> list[DraftTransaction]:
        parser = self.find_parser(raw_message)
        if not parser:
            return []
        return parser.parse(raw_message)

    @classmethod
    def get_default(cls) -> "BankParserRegistry":
        registry = cls()
        registry.register(HdfcUpiParser())
        registry.register(HdfcCardParser())
        registry.register(IciciAlertParser())
        registry.register(GenericUpiParser())
        return registry

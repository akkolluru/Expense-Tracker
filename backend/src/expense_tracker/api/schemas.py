from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class AccountCreate(BaseModel):
    name: str
    institution: str
    account_type: str = "SAVINGS"
    currency: str = "INR"
    initial_balance: Decimal = Decimal("0.00")
    account_number_last4: str | None = None


class AccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    institution: str
    account_type: str
    currency: str
    balance: Decimal
    account_number_last4: str | None = None
    is_active: bool
    created_at: datetime


class TransactionCreate(BaseModel):
    account_id: int
    amount: Decimal = Field(..., gt=Decimal("0.00"), description="Amount must be strictly positive")
    merchant_name: str
    timestamp: datetime
    destination_account_id: int | None = None
    category_id: int | None = None
    group_id: int | None = None
    currency: str = "INR"
    is_expense: bool = True
    is_transfer: bool = False
    idempotency_key: str | None = None
    description: str | None = None


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    icon: str
    color: str
    is_income: bool
    parent_category: str | None = None


class PeerSplitItemDTO(BaseModel):
    member_name: str
    share_amount: Decimal = Field(..., gt=Decimal("0.00"))
    upi_id: str | None = None
    is_paid: bool = False


class PeerSplitRequest(BaseModel):
    peer_splits: list[PeerSplitItemDTO]


class PeerSplitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_id: int
    member_name: str
    upi_id: str | None = None
    share_amount: Decimal
    is_paid: bool
    settled_at: datetime | None = None


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    destination_account_id: int | None = None
    category_id: int | None = None
    suggested_category_id: int | None = None
    group_id: int | None = None
    amount: Decimal
    currency: str
    is_expense: bool
    is_transfer: bool
    is_settlement: bool
    idempotency_key: str | None = None
    status: str
    merchant_name: str
    merchant_vpa: str | None = None
    reference_number: str | None = None
    description: str | None = None
    categorization_strategy: str
    categorization_confidence: float
    timestamp: datetime
    peer_splits: list[PeerSplitResponse] = []


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class SplitItemDTO(BaseModel):
    category_id: int
    amount: Decimal = Field(
        ..., gt=Decimal("0.00"), description="Split amount must be strictly positive"
    )
    note: str | None = None


class SplitTransactionRequest(BaseModel):
    splits: list[SplitItemDTO]


class SplitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_id: int
    category_id: int
    amount: Decimal
    note: str | None = None


class SyncParseTextRequest(BaseModel):
    raw_text: str
    source: str = "SMS"
    account_id: int | None = None


class SyncParseTextResponse(BaseModel):
    status: str
    action: str
    transaction: TransactionResponse


class SuggestedCategoryDTO(BaseModel):
    id: int
    name: str
    parent_category: str | None = None


class InboxItemResponse(BaseModel):
    id: int
    amount: Decimal
    merchant_name: str
    merchant_vpa: str | None = None
    timestamp: datetime
    suggested_category: SuggestedCategoryDTO | None = None
    confidence: float
    reasoning: str | None = None


class InboxApproveRequest(BaseModel):
    category_id: int
    learn_merchant: bool = True
    never_auto_classify: bool = False


class SystemHealthResponse(BaseModel):
    status: str
    database: str
    llm_circuit_breaker: str
    active_parsers_count: int
    timestamp: datetime

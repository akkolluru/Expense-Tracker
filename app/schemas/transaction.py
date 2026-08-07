from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TransactionBase(BaseModel):
    amount: float = Field(gt=0)
    direction: str
    currency: str = 'INR'
    timestamp: datetime
    vpa: str | None = None
    merchant_name: str | None = None
    raw_merchant_name: str | None = None
    category_id: int | None = None
    sub_category_id: int | None = None
    description: str | None = None
    txn_ref: str | None = None
    txn_type: str
    account_last4: str | None = None
    status: str = 'pending_review'
    categorized_by: str | None = None
    source: str
    email_message_id: str | None = None
    is_misclassified: bool = False

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    amount: float | None = Field(None, gt=0)
    direction: str | None = None
    timestamp: datetime | None = None
    vpa: str | None = None
    merchant_name: str | None = None
    raw_merchant_name: str | None = None
    category_id: int | None = None
    sub_category_id: int | None = None
    description: str | None = None
    txn_ref: str | None = None
    txn_type: str | None = None
    account_last4: str | None = None
    status: str | None = None
    categorized_by: str | None = None
    source: str | None = None
    is_misclassified: bool | None = None

class TransactionResponse(TransactionBase):
    id: str
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

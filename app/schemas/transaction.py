from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime

class TransactionBase(BaseModel):
    amount: float = Field(gt=0)
    direction: str
    currency: str = 'INR'
    timestamp: datetime
    vpa: Optional[str] = None
    merchant_name: Optional[str] = None
    raw_merchant_name: Optional[str] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    description: Optional[str] = None
    txn_ref: Optional[str] = None
    txn_type: str
    account_last4: Optional[str] = None
    status: str = 'pending_review'
    categorized_by: Optional[str] = None
    source: str
    email_message_id: Optional[str] = None
    is_misclassified: bool = False

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    direction: Optional[str] = None
    timestamp: Optional[datetime] = None
    vpa: Optional[str] = None
    merchant_name: Optional[str] = None
    raw_merchant_name: Optional[str] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    description: Optional[str] = None
    txn_ref: Optional[str] = None
    txn_type: Optional[str] = None
    account_last4: Optional[str] = None
    status: Optional[str] = None
    categorized_by: Optional[str] = None
    source: Optional[str] = None
    is_misclassified: Optional[bool] = None

class TransactionResponse(TransactionBase):
    id: str
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

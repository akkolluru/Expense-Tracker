from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class RuleBase(BaseModel):
    vpa: str
    merchant_name: Optional[str] = None
    category_id: int
    sub_category_id: Optional[int] = None

class RuleCreate(RuleBase):
    pass

class RuleUpdate(BaseModel):
    vpa: Optional[str] = None
    merchant_name: Optional[str] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None

class RuleResponse(RuleBase):
    id: int
    hit_count: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

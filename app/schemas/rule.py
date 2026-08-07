from datetime import datetime

from pydantic import BaseModel, ConfigDict


class RuleBase(BaseModel):
    vpa: str
    merchant_name: str | None = None
    category_id: int
    sub_category_id: int | None = None

class RuleCreate(RuleBase):
    pass

class RuleUpdate(BaseModel):
    vpa: str | None = None
    merchant_name: str | None = None
    category_id: int | None = None
    sub_category_id: int | None = None

class RuleResponse(RuleBase):
    id: int
    hit_count: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CategoryBase(BaseModel):
    name: str
    icon: str | None = None
    parent_id: int | None = None
    is_active: bool = True

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None
    parent_id: int | None = None
    is_active: bool | None = None

class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class CategoryTreeResponse(CategoryResponse):
    children: list['CategoryTreeResponse'] = []
    
    model_config = ConfigDict(from_attributes=True)

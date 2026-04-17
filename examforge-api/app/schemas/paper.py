from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class PaperCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    subject: str = Field(..., min_length=1, max_length=120)
    duration_minutes: int = Field(180, ge=1, le=600)
    total_marks: int = Field(100, ge=1)
    status: str = Field("Draft", pattern="^(Draft|In Progress|Complete)$")
    instructions: Optional[str] = None


class PaperUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    subject: Optional[str] = Field(None, min_length=1, max_length=120)
    duration_minutes: Optional[int] = Field(None, ge=1, le=600)
    total_marks: Optional[int] = Field(None, ge=1)
    status: Optional[str] = Field(None, pattern="^(Draft|In Progress|Complete)$")
    instructions: Optional[str] = None


class PaperOut(BaseModel):
    id: str
    user_id: str
    title: str
    subject: str
    duration_minutes: int
    total_marks: int
    status: str
    instructions: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaperListOut(BaseModel):
    items: list[PaperOut]
    total: int
    page: int
    page_size: int

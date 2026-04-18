from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class QuestionBankCreate(BaseModel):
    topic: str
    q_type: str = "Short Answer"
    difficulty: str = "Medium"
    bloom: str = "Understand"
    marks: int = 1
    text: str
    options: Optional[str] = None
    answer: Optional[str] = None
    is_pyq: bool = False


class QuestionBankUpdate(BaseModel):
    topic: Optional[str] = None
    q_type: Optional[str] = None
    difficulty: Optional[str] = None
    bloom: Optional[str] = None
    marks: Optional[int] = None
    text: Optional[str] = None
    options: Optional[str] = None
    answer: Optional[str] = None
    is_pyq: Optional[bool] = None


class QuestionBankOut(BaseModel):
    id: str
    topic: str
    q_type: str
    difficulty: str
    bloom: str
    marks: int
    text: str
    options: Optional[str] = None
    answer: Optional[str] = None
    is_pyq: bool
    is_ai_generated: bool
    usage_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

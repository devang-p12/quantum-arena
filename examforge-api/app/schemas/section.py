from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ── Section ──────────────────────────────────────────────────

class SectionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    instructions: Optional[str] = None
    order_index: int = Field(0, ge=0)


class SectionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    instructions: Optional[str] = None
    order_index: Optional[int] = Field(None, ge=0)


class SectionReorder(BaseModel):
    """Body for bulk reordering: list of {id, order_index}"""
    items: List[dict]   # [{id: str, order_index: int}]


class QuestionOut(BaseModel):
    id: str
    section_id: str
    topic: str
    q_type: str
    marks: int
    difficulty: str
    bloom: str
    requires_chart: bool
    chart_type: Optional[str]
    chart_mode: Optional[str]
    chart_spec: Optional[str]
    text: str
    options: Optional[str]
    answer: Optional[str]
    starred: bool
    order_index: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class SectionOut(BaseModel):
    id: str
    paper_id: str
    title: str
    instructions: Optional[str]
    order_index: int
    created_at: datetime
    updated_at: datetime
    questions: List[QuestionOut] = []
    model_config = {"from_attributes": True}


# ── Question ─────────────────────────────────────────────────

class QuestionCreate(BaseModel):
    topic: str = Field(..., min_length=1, max_length=200)
    q_type: str = Field("Short Answer")
    marks: int = Field(5, ge=0)
    difficulty: str = Field("Medium", pattern="^(Easy|Medium|Hard)$")
    bloom: str = Field("Understand")
    requires_chart: bool = False
    chart_type: Optional[str] = Field(None, pattern="^(line|bar|scatter|pie)$")
    chart_mode: Optional[str] = Field(None, pattern="^(student_plot|analyze_graph)$")
    chart_spec: Optional[str] = None
    text: str = Field(..., min_length=1)
    options: Optional[str] = None   # JSON string for MCQ options
    answer: Optional[str] = None
    order_index: int = Field(0, ge=0)


class QuestionUpdate(BaseModel):
    topic: Optional[str] = Field(None, min_length=1, max_length=200)
    q_type: Optional[str] = None
    marks: Optional[int] = Field(None, ge=0)
    difficulty: Optional[str] = Field(None, pattern="^(Easy|Medium|Hard)$")
    bloom: Optional[str] = None
    requires_chart: Optional[bool] = None
    chart_type: Optional[str] = Field(None, pattern="^(line|bar|scatter|pie)$")
    chart_mode: Optional[str] = Field(None, pattern="^(student_plot|analyze_graph)$")
    chart_spec: Optional[str] = None
    text: Optional[str] = Field(None, min_length=1)
    options: Optional[str] = None
    answer: Optional[str] = None
    order_index: Optional[int] = Field(None, ge=0)

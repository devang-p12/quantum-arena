import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING

from app.database import Base


class QuestionBankEntry(Base):
    __tablename__ = "question_bank"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Classification fields — used for lookup matching
    topic: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    q_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # MCQ, Short Answer etc.
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # Easy / Medium / Hard
    bloom: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    marks: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Content
    text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[str | None] = mapped_column(Text, nullable=True)   # JSON array string for MCQ
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Metadata
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

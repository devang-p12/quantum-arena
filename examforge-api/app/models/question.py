import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.section import Section


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    section_id: Mapped[str] = mapped_column(String, ForeignKey("sections.id", ondelete="CASCADE"), nullable=False)

    topic: Mapped[str] = mapped_column(String(200), nullable=False)
    q_type: Mapped[str] = mapped_column(String(50), nullable=False, default="Short Answer")
    marks: Mapped[int] = mapped_column(Integer, default=5)
    difficulty: Mapped[str] = mapped_column(String(20), default="Medium")   # Easy | Medium | Hard
    bloom: Mapped[str] = mapped_column(String(30), default="Understand")    # BT levels
    requires_chart: Mapped[bool] = mapped_column(Boolean, default=False)
    chart_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    chart_mode: Mapped[str | None] = mapped_column(String(30), nullable=True)  # student_plot | analyze_graph
    chart_spec: Mapped[str | None] = mapped_column(Text, nullable=True)      # JSON-serialised chart metadata/data
    text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[str | None] = mapped_column(Text, nullable=True)        # JSON-serialised list for MCQ
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    starred: Mapped[bool] = mapped_column(Boolean, default=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    section = relationship("Section", back_populates="questions")

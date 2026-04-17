"""Create sections and questions tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-17
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # sections
    op.create_table(
        "sections",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("paper_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(datetime('now'))"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(datetime('now'))"), nullable=False),
        sa.ForeignKeyConstraint(["paper_id"], ["papers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sections_paper_id", "sections", ["paper_id"])

    # questions
    op.create_table(
        "questions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("section_id", sa.String(), nullable=False),
        sa.Column("topic", sa.String(200), nullable=False),
        sa.Column("q_type", sa.String(50), nullable=False, server_default="Short Answer"),
        sa.Column("marks", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("difficulty", sa.String(20), nullable=False, server_default="Medium"),
        sa.Column("bloom", sa.String(30), nullable=False, server_default="Understand"),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("options", sa.Text(), nullable=True),
        sa.Column("answer", sa.Text(), nullable=True),
        sa.Column("starred", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(datetime('now'))"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(datetime('now'))"), nullable=False),
        sa.ForeignKeyConstraint(["section_id"], ["sections.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_questions_section_id", "questions", ["section_id"])
    op.create_index("ix_questions_starred", "questions", ["starred"])


def downgrade() -> None:
    op.drop_index("ix_questions_starred", table_name="questions")
    op.drop_index("ix_questions_section_id", table_name="questions")
    op.drop_table("questions")
    op.drop_index("ix_sections_paper_id", table_name="sections")
    op.drop_table("sections")

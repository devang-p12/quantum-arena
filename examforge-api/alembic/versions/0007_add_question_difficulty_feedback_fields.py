"""Add difficulty feedback fields to questions

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "questions",
        sa.Column("difficulty_score", sa.Integer(), nullable=False, server_default="3"),
    )
    op.add_column(
        "questions",
        sa.Column("feedback_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("questions", "feedback_count")
    op.drop_column("questions", "difficulty_score")

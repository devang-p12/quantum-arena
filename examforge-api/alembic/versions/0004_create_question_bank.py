"""Create question_bank table

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-17
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "question_bank",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("topic", sa.String(255), nullable=False, index=True),
        sa.Column("q_type", sa.String(50), nullable=False, index=True),
        sa.Column("difficulty", sa.String(20), nullable=False, index=True),
        sa.Column("bloom", sa.String(50), nullable=False, index=True),
        sa.Column("marks", sa.Integer(), nullable=False, default=1),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("options", sa.Text(), nullable=True),
        sa.Column("answer", sa.Text(), nullable=True),
        sa.Column("is_ai_generated", sa.Boolean(), default=False),
        sa.Column("usage_count", sa.Integer(), default=0),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("question_bank")

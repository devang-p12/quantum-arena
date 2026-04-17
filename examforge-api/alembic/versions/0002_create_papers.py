"""Create papers table

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-17
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "papers",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(120), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="180"),
        sa.Column("total_marks", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("status", sa.String(30), nullable=False, server_default="Draft"),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(datetime('now'))"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(datetime('now'))"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_papers_user_id", "papers", ["user_id"])
    op.create_index("ix_papers_status", "papers", ["status"])
    op.create_index("ix_papers_subject", "papers", ["subject"])


def downgrade() -> None:
    op.drop_index("ix_papers_subject", table_name="papers")
    op.drop_index("ix_papers_status", table_name="papers")
    op.drop_index("ix_papers_user_id", table_name="papers")
    op.drop_table("papers")

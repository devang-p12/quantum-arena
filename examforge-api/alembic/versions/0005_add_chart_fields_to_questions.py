"""Add chart fields to questions

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("questions", sa.Column("requires_chart", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("questions", sa.Column("chart_type", sa.String(length=20), nullable=True))
    op.add_column("questions", sa.Column("chart_spec", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("questions", "chart_spec")
    op.drop_column("questions", "chart_type")
    op.drop_column("questions", "requires_chart")

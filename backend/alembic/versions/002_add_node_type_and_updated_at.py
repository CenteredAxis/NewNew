"""add node_type and updated_at to nodes

Revision ID: a1b2c3d4e5f6
Revises: d68c2599ecb5
Create Date: 2026-02-22 07:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "d68c2599ecb5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add node_type and updated_at columns to nodes table."""
    op.add_column(
        "nodes",
        sa.Column(
            "node_type",
            sa.String(),
            nullable=False,
            server_default="message",
        ),
    )
    op.add_column(
        "nodes",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Remove node_type and updated_at columns from nodes table."""
    op.drop_column("nodes", "updated_at")
    op.drop_column("nodes", "node_type")

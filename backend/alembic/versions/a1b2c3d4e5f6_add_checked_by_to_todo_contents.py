"""add_checked_by_to_todo_contents

Revision ID: a1b2c3d4e5f6
Revises: 4dccb1b603fc
Create Date: 2026-06-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '4dccb1b603fc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('todo_contents', sa.Column('checked_by', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('todo_contents', 'checked_by')

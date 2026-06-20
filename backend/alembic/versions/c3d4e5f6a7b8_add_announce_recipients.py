"""add_announce_recipients

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'announce_recipients',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('announce_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['announce_id'], ['announces.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_announce_recipients_announce_id', 'announce_recipients', ['announce_id'])


def downgrade() -> None:
    op.drop_index('ix_announce_recipients_announce_id', table_name='announce_recipients')
    op.drop_table('announce_recipients')

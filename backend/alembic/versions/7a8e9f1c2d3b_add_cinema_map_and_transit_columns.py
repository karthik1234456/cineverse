"""Add cinema map and transit columns

Revision ID: 7a8e9f1c2d3b
Revises: 0f41eaaa443b
Create Date: 2026-11-06 21:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a8e9f1c2d3b'
down_revision: Union[str, Sequence[str], None] = '0f41eaaa443b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns to cinemas table
    with op.batch_alter_table('cinemas', schema=None) as batch_op:
        batch_op.add_column(sa.Column('pincode', sa.String(length=10), nullable=True))
        batch_op.add_column(sa.Column('landmark', sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column('parking', sa.String(length=50), nullable=True, server_default='Covered'))
        batch_op.add_column(sa.Column('transit_stop', sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column('phone', sa.String(length=50), nullable=True, server_default='+91 80 4000 1234'))
        batch_op.add_column(sa.Column('opening_hours', sa.String(length=100), nullable=True, server_default='09:00 AM - 11:30 PM'))
        batch_op.add_column(sa.Column('is_demo_data', sa.Boolean(), nullable=True, server_default='1'))


def downgrade() -> None:
    with op.batch_alter_table('cinemas', schema=None) as batch_op:
        batch_op.drop_column('is_demo_data')
        batch_op.drop_column('opening_hours')
        batch_op.drop_column('phone')
        batch_op.drop_column('transit_stop')
        batch_op.drop_column('parking')
        batch_op.drop_column('landmark')
        batch_op.drop_column('pincode')

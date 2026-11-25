"""Add problem reports table

Revision ID: 8b9c0d1e2f3a
Revises: 7a8e9f1c2d3b
Create Date: 2026-11-13 18:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b9c0d1e2f3a'
down_revision: Union[str, Sequence[str], None] = '7a8e9f1c2d3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'problem_reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(length=50), server_default='open', nullable=True),
        sa.Column('user_description', sa.Text(), nullable=False),
        sa.Column('expected_behavior', sa.Text(), nullable=True),
        sa.Column('screenshot_filename', sa.String(length=255), nullable=True),
        sa.Column('url', sa.String(length=500), nullable=False),
        sa.Column('route', sa.String(length=200), nullable=False),
        sa.Column('query_params', sa.JSON(), nullable=True),
        sa.Column('build_stamp', sa.String(length=100), nullable=True),
        sa.Column('auditorium_id', sa.String(length=50), nullable=True),
        sa.Column('showtime_id', sa.Integer(), nullable=True),
        sa.Column('cinema_id', sa.Integer(), nullable=True),
        sa.Column('mode', sa.String(length=50), nullable=True),
        sa.Column('selected_seats', sa.JSON(), nullable=True),
        sa.Column('console_logs', sa.JSON(), nullable=True),
        sa.Column('network_requests', sa.JSON(), nullable=True),
        sa.Column('browser_info', sa.JSON(), nullable=True),
        sa.Column('render_metrics', sa.JSON(), nullable=True),
        sa.Column('reporter_ip', sa.String(length=100), nullable=True),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_problem_reports_id'), 'problem_reports', ['id'], unique=False)
    op.create_index(op.f('ix_problem_reports_status'), 'problem_reports', ['status'], unique=False)
    op.create_index(op.f('ix_problem_reports_created_at'), 'problem_reports', ['created_at'], unique=False)
    op.create_index(op.f('ix_problem_reports_route'), 'problem_reports', ['route'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_problem_reports_route'), table_name='problem_reports')
    op.drop_index(op.f('ix_problem_reports_created_at'), table_name='problem_reports')
    op.drop_index(op.f('ix_problem_reports_status'), table_name='problem_reports')
    op.drop_index(op.f('ix_problem_reports_id'), table_name='problem_reports')
    op.drop_table('problem_reports')


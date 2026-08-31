"""add pending_review status

Revision ID: 466165427734
Revises: 0a92e9062275
Create Date: 2026-08-28 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '466165427734'
down_revision = '0a92e9062275'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE section_status ADD VALUE IF NOT EXISTS 'pending_review'")


def downgrade():
    pass
"""Create initial Sabaqtas backend core schema."""

from alembic import op

from app.core.db import Base
from app.repositories import load_models

revision = "20260821_0001"
down_revision = None
branch_labels = None
depends_on = None

load_models()


def upgrade() -> None:
    Base.metadata.create_all(op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(op.get_bind())

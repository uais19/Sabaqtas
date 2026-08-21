"""SQLAlchemy persistence operations and ORM records."""


def load_models() -> None:
    """Register every ORM record on Base before Alembic reads metadata."""
    from app.repositories import classes, diagnostics, knowledge, learning_plan, progress, topics, users

    _ = (classes, diagnostics, knowledge, learning_plan, progress, topics, users)

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class StudentTopicProgressRecord(Base):
    __tablename__ = "student_topic_progress"
    __table_args__ = (UniqueConstraint("student_id", "topic_id", name="uq_student_topic_progress"), CheckConstraint("mastery >= 0 AND mastery <= 100", name="ck_progress_mastery_range"))
    student_id: Mapped[UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), primary_key=True)
    topic_id: Mapped[UUID] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True)
    mastery: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    correct_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hints_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    gave_up_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_activity_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

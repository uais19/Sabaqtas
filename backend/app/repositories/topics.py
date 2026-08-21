from typing import cast
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String, UniqueConstraint, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class SubjectRecord(Base):
    __tablename__ = "subjects"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(100), nullable=False)


class TopicRecord(Base):
    __tablename__ = "topics"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    subject_id: Mapped[UUID] = mapped_column(ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    grade: Mapped[int] = mapped_column(nullable=False)
    source_ref: Mapped[str] = mapped_column(String(500), nullable=False)


class TopicPrerequisiteRecord(Base):
    __tablename__ = "topic_prerequisites"
    __table_args__ = (UniqueConstraint("topic_id", "prerequisite_topic_id", name="uq_topic_prerequisite"),)
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    topic_id: Mapped[UUID] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    prerequisite_topic_id: Mapped[UUID] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)


class TopicRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_subject(self, code: str) -> SubjectRecord | None:
        return cast(SubjectRecord | None, await self.session.scalar(select(SubjectRecord).where(SubjectRecord.code == code)))

    async def get_starting_topic(self, subject_id: UUID, grade: int) -> TopicRecord | None:
        statement = select(TopicRecord).where(TopicRecord.subject_id == subject_id, TopicRecord.grade == grade).order_by(TopicRecord.title)
        return cast(TopicRecord | None, await self.session.scalar(statement))

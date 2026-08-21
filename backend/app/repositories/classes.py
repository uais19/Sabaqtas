from typing import cast
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ClassRecord(Base):
    __tablename__ = "classes"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    teacher_id: Mapped[UUID] = mapped_column(ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    grade: Mapped[int] = mapped_column(nullable=False)


class ClassMemberRecord(Base):
    __tablename__ = "class_members"
    __table_args__ = (UniqueConstraint("class_id", "student_id", name="uq_class_membership"),)
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    class_id: Mapped[UUID] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)


class ClassRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, class_id: UUID) -> ClassRecord | None:
        return cast(ClassRecord | None, await self.session.get(ClassRecord, class_id))

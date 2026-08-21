from typing import cast
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.users import StudentRecord


class StudentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_user_id(self, user_id: UUID) -> StudentRecord | None:
        statement = select(StudentRecord).where(StudentRecord.user_id == user_id)
        return cast(StudentRecord | None, await self.session.scalar(statement))

    async def get_by_id(self, student_id: UUID) -> StudentRecord | None:
        return cast(StudentRecord | None, await self.session.get(StudentRecord, student_id))

from typing import Protocol
from uuid import UUID

from app.core.errors import ForbiddenError
from app.domain.progress import StudentTopicProgress


class StudentLookup(Protocol):
    async def get_by_user_id(self, user_id: UUID): ...


class ProgressService:
    def __init__(self, students: StudentLookup | None = None) -> None:
        self.students = students

    async def ensure_student_owner(self, user_id: UUID, student_id: UUID) -> None:
        if self.students is None:
            raise RuntimeError("Student repository is required")
        student = await self.students.get_by_user_id(user_id)
        if student is None or student.id != student_id:
            raise ForbiddenError("Student cannot access this resource")

    @staticmethod
    def mastery(progress: StudentTopicProgress) -> int:
        return round(progress.correct_attempts / progress.attempts * 100) if progress.attempts else 0

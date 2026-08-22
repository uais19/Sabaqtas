from typing import Protocol
from uuid import UUID

from app.core.errors import ForbiddenError
from app.domain.diagnostics import DiagnosticResult
from app.domain.topics import Topic


class StudentLookup(Protocol):
    async def get_by_user_id(self, user_id: UUID) -> "StudentIdentity | None": ...


class StudentIdentity(Protocol):
    id: UUID


class LearningPlanService:
    def __init__(self, students: StudentLookup | None = None) -> None:
        self.students = students

    async def ensure_student_owner(self, user_id: UUID, student_id: UUID) -> None:
        if self.students is None:
            raise RuntimeError("Student repository is required")
        student = await self.students.get_by_user_id(user_id)
        if student is None or student.id != student_id:
            raise ForbiddenError("Student cannot access this resource")

    def topics_from_diagnostic(self, result: DiagnosticResult) -> list[Topic]:
        """Remediation begins at the deepest failed prerequisite, then rises."""
        if result.root_topic is None:
            return []
        return list(reversed([step.topic for step in result.path if not step.is_correct]))

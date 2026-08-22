from typing import Protocol
from uuid import UUID

from app.core.errors import ForbiddenError


class TeacherService:
    def __init__(self, teachers: "TeacherLookup | None" = None, classes: "ClassLookup | None" = None) -> None:
        self.teachers = teachers
        self.classes = classes

    async def ensure_class_owner_for_user(self, user_id: UUID, class_id: UUID) -> None:
        if self.teachers is None or self.classes is None:
            raise RuntimeError("Teacher and class repositories are required")
        teacher = await self.teachers.get_by_user_id(user_id)
        classroom = await self.classes.get_by_id(class_id)
        if teacher is None or classroom is None:
            raise ForbiddenError("Teacher cannot access this class")
        self.ensure_class_owner(classroom.teacher_id, teacher.id)

    @staticmethod
    def ensure_class_owner(class_teacher_id: UUID, current_teacher_id: UUID) -> None:
        if class_teacher_id != current_teacher_id:
            raise ForbiddenError("Teacher does not own this class")


class TeacherLookup(Protocol):
    async def get_by_user_id(self, user_id: UUID) -> "TeacherIdentity | None": ...


class ClassLookup(Protocol):
    async def get_by_id(self, class_id: UUID) -> "ClassIdentity | None": ...


class TeacherIdentity(Protocol):
    id: UUID


class ClassIdentity(Protocol):
    teacher_id: UUID

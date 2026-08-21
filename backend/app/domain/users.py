from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID


class UserRole(StrEnum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


@dataclass(frozen=True)
class User:
    id: UUID
    email: str
    role: UserRole

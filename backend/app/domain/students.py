from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class Student:
    id: UUID
    user_id: UUID
    full_name: str
    grade: int

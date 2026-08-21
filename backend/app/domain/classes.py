from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class Class:
    id: UUID
    teacher_id: UUID
    title: str
    grade: int

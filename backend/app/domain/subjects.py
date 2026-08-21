from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class Subject:
    id: UUID
    code: str
    title: str

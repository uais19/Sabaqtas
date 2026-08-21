from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class Topic:
    id: UUID
    subject_id: UUID
    title: str
    grade: int
    source_ref: str


@dataclass(frozen=True)
class TopicPrerequisite:
    topic_id: UUID
    prerequisite_topic_id: UUID

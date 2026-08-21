from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class LearningPlan:
    id: UUID
    student_id: UUID


@dataclass(frozen=True)
class LearningPlanItem:
    id: UUID
    plan_id: UUID
    topic_id: UUID
    position: int
    reason: str

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True)
class StudentTopicProgress:
    student_id: UUID
    topic_id: UUID
    mastery: int
    attempts: int
    correct_attempts: int
    hints_count: int
    gave_up_count: int
    last_activity_at: datetime | None

from uuid import UUID

from app.schemas.common import ApiModel, TopicResponse


class TeacherStudentResponse(ApiModel):
    student_id: UUID
    name: str
    grade: int
    root_topic: TopicResponse | None
    progress_percent: int
    closed_gaps: int
    gave_up_count: int
    last_active: str | None


class TeacherStudentsResponse(ApiModel):
    students: list[TeacherStudentResponse]


class TeacherTopicStatsResponse(ApiModel):
    topic_id: UUID
    title: str
    grade: int
    avg_mastery: int
    students_struggling: int
    avg_hints: float
    gave_up_count: int


class TeacherStatsResponse(ApiModel):
    class_title: str
    students_total: int
    topics: list[TeacherTopicStatsResponse]

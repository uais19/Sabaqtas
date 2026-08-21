from uuid import UUID

from app.schemas.common import ApiModel, TopicResponse


class TopicProgressResponse(ApiModel):
    topic_id: UUID
    title: str
    grade: int
    mastery: int
    status: str


class ProgressResponse(ApiModel):
    root_topic: TopicResponse | None
    topics: list[TopicProgressResponse]
    closed_gaps: int

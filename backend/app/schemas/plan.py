from uuid import UUID

from app.schemas.common import ApiModel, TopicResponse


class LearningPlanItemResponse(ApiModel):
    topic: TopicResponse
    reason: str
    position: int


class LearningPlanResponse(ApiModel):
    plan_id: UUID
    items: list[LearningPlanItemResponse]

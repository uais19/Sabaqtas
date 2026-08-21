from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TopicResponse(ApiModel):
    id: UUID
    title: str
    grade: int
    source_ref: str

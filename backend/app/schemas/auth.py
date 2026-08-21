from uuid import UUID

from app.schemas.common import ApiModel


class CurrentUserResponse(ApiModel):
    id: UUID
    role: str

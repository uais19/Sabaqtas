from dataclasses import dataclass
from uuid import UUID

import jwt
from jwt import InvalidTokenError

from app.core.config import get_settings
from app.core.errors import ForbiddenError, ServiceUnavailableError


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    role: str


def decode_access_token(token: str) -> CurrentUser:
    settings = get_settings()
    if not settings.jwt_secret:
        raise ServiceUnavailableError("JWT authentication is not configured")
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return CurrentUser(id=UUID(str(payload["sub"])), role=str(payload["role"]))
    except (InvalidTokenError, KeyError, ValueError) as error:
        raise ForbiddenError("Invalid access token") from error


def require_role(current_user: CurrentUser, role: str) -> None:
    if current_user.role != role:
        raise ForbiddenError("Insufficient permissions")

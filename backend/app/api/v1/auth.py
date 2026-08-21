from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.security import CurrentUser
from app.schemas.auth import CurrentUserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=CurrentUserResponse)
async def me(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUserResponse:
    return CurrentUserResponse(id=current_user.id, role=current_user.role)

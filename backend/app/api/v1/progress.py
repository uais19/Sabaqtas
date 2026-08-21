from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import ProgressServiceDependency, require_student
from app.core.security import CurrentUser
from app.schemas.progress import ProgressResponse

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/{student_id}", response_model=ProgressResponse)
async def get_progress(student_id: UUID, service: ProgressServiceDependency, current_user: CurrentUser = Depends(require_student)) -> ProgressResponse:
    await service.ensure_student_owner(current_user.id, student_id)
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Progress persistence is not populated yet")

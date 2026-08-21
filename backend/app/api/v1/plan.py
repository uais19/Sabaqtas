from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import LearningPlanServiceDependency, require_student
from app.core.security import CurrentUser
from app.schemas.plan import LearningPlanResponse

router = APIRouter(prefix="/plan", tags=["learning plan"])


@router.get("/{student_id}", response_model=LearningPlanResponse)
async def get_plan(student_id: UUID, service: LearningPlanServiceDependency, current_user: CurrentUser = Depends(require_student)) -> LearningPlanResponse:
    await service.ensure_student_owner(current_user.id, student_id)
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Learning plan persistence is not populated yet")

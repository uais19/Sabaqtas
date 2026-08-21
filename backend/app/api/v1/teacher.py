from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import TeacherServiceDependency, require_teacher
from app.core.security import CurrentUser
from app.schemas.teacher import TeacherStatsResponse, TeacherStudentsResponse

router = APIRouter(prefix="/teacher", tags=["teacher"])


@router.get("/students/{class_id}", response_model=TeacherStudentsResponse)
async def get_students(class_id: UUID, service: TeacherServiceDependency, current_user: CurrentUser = Depends(require_teacher)) -> TeacherStudentsResponse:
    await service.ensure_class_owner_for_user(current_user.id, class_id)
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Teacher analytics persistence is not populated yet")


@router.get("/stats/{class_id}", response_model=TeacherStatsResponse)
async def get_stats(class_id: UUID, service: TeacherServiceDependency, current_user: CurrentUser = Depends(require_teacher)) -> TeacherStatsResponse:
    await service.ensure_class_owner_for_user(current_user.id, class_id)
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Teacher analytics persistence is not populated yet")

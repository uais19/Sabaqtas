from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import ForbiddenError, ServiceUnavailableError
from app.core.security import CurrentUser, decode_access_token, require_role
from app.repositories.classes import ClassRepository
from app.repositories.diagnostics import SqlAlchemyDiagnosticRepository
from app.repositories.students import StudentRepository
from app.repositories.users import TeacherRepository
from app.services.diagnostics import DiagnosticService
from app.services.learning_plan import LearningPlanService
from app.services.progress import ProgressService
from app.services.teacher import TeacherService

bearer_scheme = HTTPBearer(auto_error=False)
SessionDependency = Annotated[AsyncSession, Depends(get_session)]


def get_diagnostic_service(session: SessionDependency) -> DiagnosticService:
    return DiagnosticService(SqlAlchemyDiagnosticRepository(session))


def get_learning_plan_service(session: SessionDependency) -> LearningPlanService:
    return LearningPlanService(StudentRepository(session))


def get_progress_service(session: SessionDependency) -> ProgressService:
    return ProgressService(StudentRepository(session))


def get_teacher_service(session: SessionDependency) -> TeacherService:
    return TeacherService(TeacherRepository(session), ClassRepository(session))


DiagnosticServiceDependency = Annotated[DiagnosticService, Depends(get_diagnostic_service)]
LearningPlanServiceDependency = Annotated[LearningPlanService, Depends(get_learning_plan_service)]
ProgressServiceDependency = Annotated[ProgressService, Depends(get_progress_service)]
TeacherServiceDependency = Annotated[TeacherService, Depends(get_teacher_service)]


def get_current_user(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        return decode_access_token(credentials.credentials)
    except ForbiddenError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(error)) from error
    except ServiceUnavailableError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


def require_student(current_user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
    try:
        require_role(current_user, "student")
    except ForbiddenError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    return current_user


def require_teacher(current_user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
    try:
        require_role(current_user, "teacher")
    except ForbiddenError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    return current_user

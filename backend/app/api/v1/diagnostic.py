from fastapi import APIRouter, Depends

from app.api.deps import DiagnosticServiceDependency, require_student
from app.core.security import CurrentUser
from app.domain.diagnostics import DiagnosticAnswerResult, QuestionPayload
from app.schemas.common import TopicResponse
from app.schemas.diagnostic import (
    DiagnosticAnswerRequest,
    DiagnosticAnswerResponse,
    DiagnosticPathStepResponse,
    DiagnosticQuestionResponse,
    DiagnosticResultResponse,
    DiagnosticStartRequest,
    DiagnosticStartResponse,
)

router = APIRouter(prefix="/diagnostic", tags=["diagnostic"])


@router.post("/start", response_model=DiagnosticStartResponse, status_code=201)
async def start_diagnostic(
    request: DiagnosticStartRequest,
    service: DiagnosticServiceDependency,
    current_user: CurrentUser = Depends(require_student),
) -> DiagnosticStartResponse:
    diagnostic_id, question = await service.start(current_user.id, request.subject, request.grade)
    return DiagnosticStartResponse(diagnostic_id=diagnostic_id, question=_question_response(question))


@router.post("/answer", response_model=DiagnosticAnswerResponse)
async def answer_diagnostic(
    request: DiagnosticAnswerRequest,
    service: DiagnosticServiceDependency,
    current_user: CurrentUser = Depends(require_student),
) -> DiagnosticAnswerResponse:
    result = await service.answer(current_user.id, request.diagnostic_id, request.question_id, request.answer)
    return _answer_response(result)


def _question_response(question: QuestionPayload) -> DiagnosticQuestionResponse:
    return DiagnosticQuestionResponse(**question.__dict__)


def _answer_response(result: DiagnosticAnswerResult) -> DiagnosticAnswerResponse:
    question = _question_response(result.question) if result.question else None
    diagnostic_result = None
    if result.result:
        root_topic = TopicResponse(**result.result.root_topic.__dict__) if result.result.root_topic else None
        path = [DiagnosticPathStepResponse(topic_id=step.topic.id, title=step.topic.title, grade=step.topic.grade, is_correct=step.is_correct) for step in result.result.path]
        diagnostic_result = DiagnosticResultResponse(root_topic=root_topic, path=path)
    return DiagnosticAnswerResponse(is_correct=result.is_correct, status=result.status, question=question, result=diagnostic_result)

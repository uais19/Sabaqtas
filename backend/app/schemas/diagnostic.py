from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.common import ApiModel, TopicResponse


class DiagnosticStartRequest(ApiModel):
    subject: str = Field(min_length=2, max_length=50)
    grade: int = Field(ge=1, le=12)


class DiagnosticQuestionResponse(ApiModel):
    id: UUID
    text: str
    options: list[str]
    topic_title: str
    grade: int


class DiagnosticStartResponse(ApiModel):
    diagnostic_id: UUID
    question: DiagnosticQuestionResponse


class DiagnosticAnswerRequest(ApiModel):
    diagnostic_id: UUID
    question_id: UUID
    answer: str = Field(min_length=1, max_length=500)


class DiagnosticPathStepResponse(ApiModel):
    topic_id: UUID
    title: str
    grade: int
    is_correct: bool


class DiagnosticResultResponse(ApiModel):
    root_topic: TopicResponse | None
    path: list[DiagnosticPathStepResponse]


class DiagnosticAnswerResponse(ApiModel):
    is_correct: bool
    status: Literal["continue", "finished"]
    question: DiagnosticQuestionResponse | None = None
    result: DiagnosticResultResponse | None = None

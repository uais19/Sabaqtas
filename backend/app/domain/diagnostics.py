from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID

from app.domain.topics import Topic


class DiagnosticStatus(StrEnum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


@dataclass
class Diagnostic:
    id: UUID
    student_id: UUID
    subject_id: UUID
    target_grade: int
    status: DiagnosticStatus
    current_question_id: UUID | None
    started_at: datetime
    path: list["DiagnosticPathStep"] = field(default_factory=list)


@dataclass
class DiagnosticQuestion:
    id: UUID
    diagnostic_id: UUID
    topic: Topic
    text: str
    options: list[str]
    correct_index: int


@dataclass(frozen=True)
class DiagnosticAnswer:
    diagnostic_id: UUID
    question_id: UUID
    answer: str
    is_correct: bool
    answered_at: datetime


@dataclass(frozen=True)
class DiagnosticPathStep:
    topic: Topic
    is_correct: bool


@dataclass(frozen=True)
class QuestionPayload:
    id: UUID
    text: str
    options: list[str]
    topic_title: str
    grade: int


@dataclass(frozen=True)
class DiagnosticResult:
    root_topic: Topic | None
    path: list[DiagnosticPathStep]


@dataclass(frozen=True)
class DiagnosticAnswerResult:
    is_correct: bool
    status: Literal["continue", "finished"]
    question: QuestionPayload | None = None
    result: DiagnosticResult | None = None

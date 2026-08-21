from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.domain.diagnostics import Diagnostic, DiagnosticAnswer, DiagnosticQuestion, DiagnosticStatus
from app.domain.topics import Topic
from app.services.diagnostics import DiagnosticService


class InMemoryDiagnosticRepository:
    def __init__(self, diagnostic: Diagnostic, questions: dict, prerequisites: dict) -> None:
        self.diagnostic = diagnostic
        self.questions = questions
        self.prerequisites = prerequisites
        self.answers: list[DiagnosticAnswer] = []

    @asynccontextmanager
    async def transaction(self):
        yield

    async def get_student_id(self, user_id):
        return user_id

    async def start(self, student_id, subject_code, grade):
        question = self.questions[self.diagnostic.current_question_id]
        return self.diagnostic, question

    async def get_for_student(self, diagnostic_id, student_id, *, lock=False):
        if diagnostic_id == self.diagnostic.id and student_id == self.diagnostic.student_id:
            return self.diagnostic
        return None

    async def get_question(self, question_id):
        return self.questions.get(question_id)

    async def get_question_for_diagnostic_topic(self, diagnostic_id, topic_id):
        return next(
            (
                question
                for question in self.questions.values()
                if question.diagnostic_id == diagnostic_id and question.topic.id == topic_id
            ),
            None,
        )

    async def get_prerequisites(self, topic_id):
        return self.prerequisites.get(topic_id, [])

    async def add_answer(self, answer):
        self.answers.append(answer)

    async def save_state(self, diagnostic):
        self.diagnostic = diagnostic


def make_topic(title: str, grade: int) -> Topic:
    return Topic(id=uuid4(), subject_id=uuid4(), title=title, grade=grade, source_ref="Учебник, стр. 10")


def make_diagnostic(question: DiagnosticQuestion) -> Diagnostic:
    return Diagnostic(
        id=uuid4(),
        student_id=uuid4(),
        subject_id=question.topic.subject_id,
        target_grade=question.topic.grade,
        status=DiagnosticStatus.IN_PROGRESS,
        current_question_id=question.id,
        started_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_start_resolves_the_student_from_the_authenticated_user() -> None:
    topic = make_topic("Квадратные уравнения", 8)
    question = DiagnosticQuestion(id=uuid4(), diagnostic_id=uuid4(), topic=topic, text="x?", options=["1", "2"], correct_index=1)
    diagnostic = make_diagnostic(question)
    question.diagnostic_id = diagnostic.id
    service = DiagnosticService(InMemoryDiagnosticRepository(diagnostic, {question.id: question}, {}))

    diagnostic_id, payload = await service.start(diagnostic.student_id, "math", 8)

    assert diagnostic_id == diagnostic.id
    assert payload.id == question.id


@pytest.mark.asyncio
async def test_wrong_answer_moves_to_prerequisite_without_exposing_correct_answer() -> None:
    advanced = make_topic("Квадратные уравнения", 8)
    foundation = make_topic("Дроби", 5)
    current = DiagnosticQuestion(id=uuid4(), diagnostic_id=uuid4(), topic=advanced, text="x?", options=["1", "2"], correct_index=1)
    next_question = DiagnosticQuestion(id=uuid4(), diagnostic_id=current.diagnostic_id, topic=foundation, text="2/3?", options=["a", "b"], correct_index=0)
    diagnostic = make_diagnostic(current)
    current.diagnostic_id = diagnostic.id
    next_question.diagnostic_id = diagnostic.id
    repository = InMemoryDiagnosticRepository(diagnostic, {current.id: current, next_question.id: next_question}, {advanced.id: [foundation]})
    service = DiagnosticService(repository)

    result = await service.answer(diagnostic.student_id, diagnostic.id, current.id, "1")

    assert result.status == "continue"
    assert result.is_correct is False
    assert result.question is not None
    assert result.question.id == next_question.id
    assert not hasattr(result.question, "correct_index")
    assert diagnostic.current_question_id == next_question.id


@pytest.mark.asyncio
async def test_correct_answer_finishes_without_root_gap() -> None:
    topic = make_topic("Квадратные уравнения", 8)
    question = DiagnosticQuestion(id=uuid4(), diagnostic_id=uuid4(), topic=topic, text="x?", options=["1", "2"], correct_index=1)
    diagnostic = make_diagnostic(question)
    question.diagnostic_id = diagnostic.id
    service = DiagnosticService(InMemoryDiagnosticRepository(diagnostic, {question.id: question}, {}))

    result = await service.answer(diagnostic.student_id, diagnostic.id, question.id, "2")

    assert result.status == "finished"
    assert result.result is not None
    assert result.result.root_topic is None
    assert diagnostic.status is DiagnosticStatus.COMPLETED


@pytest.mark.asyncio
async def test_replaying_an_answer_is_rejected_after_current_question_changes() -> None:
    topic = make_topic("Квадратные уравнения", 8)
    prerequisite = make_topic("Дроби", 5)
    question = DiagnosticQuestion(id=uuid4(), diagnostic_id=uuid4(), topic=topic, text="x?", options=["1", "2"], correct_index=1)
    next_question = DiagnosticQuestion(id=uuid4(), diagnostic_id=question.diagnostic_id, topic=prerequisite, text="2/3?", options=["a", "b"], correct_index=0)
    diagnostic = make_diagnostic(question)
    question.diagnostic_id = diagnostic.id
    next_question.diagnostic_id = diagnostic.id
    service = DiagnosticService(InMemoryDiagnosticRepository(diagnostic, {question.id: question, next_question.id: next_question}, {topic.id: [prerequisite]}))

    await service.answer(diagnostic.student_id, diagnostic.id, question.id, "1")

    with pytest.raises(ValueError, match="current"):
        await service.answer(diagnostic.student_id, diagnostic.id, question.id, "1")

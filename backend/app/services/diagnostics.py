from contextlib import AbstractAsyncContextManager
from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID

from app.core.errors import ConflictError, NotFoundError
from app.domain.diagnostics import (
    Diagnostic,
    DiagnosticAnswer,
    DiagnosticAnswerResult,
    DiagnosticPathStep,
    DiagnosticQuestion,
    DiagnosticResult,
    DiagnosticStatus,
    QuestionPayload,
)
from app.domain.topics import Topic


class DiagnosticRepository(Protocol):
    def transaction(self) -> AbstractAsyncContextManager[None]: ...
    async def get_student_id(self, user_id: UUID) -> UUID | None: ...
    async def start(self, student_id: UUID, subject_code: str, grade: int) -> tuple[Diagnostic, DiagnosticQuestion] | None: ...
    async def get_for_student(self, diagnostic_id: UUID, student_id: UUID, *, lock: bool = False) -> Diagnostic | None: ...
    async def get_question(self, question_id: UUID) -> DiagnosticQuestion | None: ...
    async def get_question_for_diagnostic_topic(self, diagnostic_id: UUID, topic_id: UUID) -> DiagnosticQuestion | None: ...
    async def get_prerequisites(self, topic_id: UUID) -> list[Topic]: ...
    async def add_answer(self, answer: DiagnosticAnswer) -> None: ...
    async def save_state(self, diagnostic: Diagnostic) -> None: ...


class DiagnosticService:
    def __init__(self, repository: DiagnosticRepository) -> None:
        self.repository = repository

    async def start(self, user_id: UUID, subject_code: str, grade: int) -> tuple[UUID, QuestionPayload]:
        async with self.repository.transaction():
            student_id = await self._student_id(user_id)
            started = await self.repository.start(student_id, subject_code, grade)
            if started is None:
                raise NotFoundError("No diagnostic content is configured for this subject and grade")
            diagnostic, question = started
            return diagnostic.id, self._payload(question)

    async def answer(self, user_id: UUID, diagnostic_id: UUID, question_id: UUID, answer: str) -> DiagnosticAnswerResult:
        async with self.repository.transaction():
            student_id = await self._student_id(user_id)
            diagnostic = await self.repository.get_for_student(diagnostic_id, student_id, lock=True)
            if diagnostic is None:
                raise NotFoundError("Diagnostic not found")
            if diagnostic.status is not DiagnosticStatus.IN_PROGRESS:
                raise ConflictError("Diagnostic is not active")
            if diagnostic.current_question_id != question_id:
                raise ConflictError("Question is not current")

            question = await self.repository.get_question(question_id)
            if question is None or question.diagnostic_id != diagnostic.id:
                raise NotFoundError("Diagnostic question not found")
            if answer not in question.options and answer != "Не знаю":
                raise ValueError("Answer must match an offered option")

            is_correct = answer in question.options and question.options.index(answer) == question.correct_index
            step = DiagnosticPathStep(topic=question.topic, is_correct=is_correct)
            diagnostic.path.append(step)
            await self.repository.add_answer(DiagnosticAnswer(diagnostic.id, question.id, answer, is_correct, datetime.now(UTC)))

            if is_correct:
                return await self._finish(diagnostic, True)

            prerequisites = await self.repository.get_prerequisites(question.topic.id)
            for topic in prerequisites:
                next_question = await self.repository.get_question_for_diagnostic_topic(diagnostic.id, topic.id)
                if next_question is not None:
                    diagnostic.current_question_id = next_question.id
                    await self.repository.save_state(diagnostic)
                    return DiagnosticAnswerResult(False, "continue", question=self._payload(next_question))
            return await self._finish(diagnostic, False)

    async def _student_id(self, user_id: UUID) -> UUID:
        student_id = await self.repository.get_student_id(user_id)
        if student_id is None:
            raise NotFoundError("Student profile not found")
        return student_id

    @staticmethod
    def _payload(question: DiagnosticQuestion) -> QuestionPayload:
        return QuestionPayload(question.id, question.text, question.options, question.topic.title, question.topic.grade)

    async def _finish(self, diagnostic: Diagnostic, is_correct: bool) -> DiagnosticAnswerResult:
        diagnostic.status = DiagnosticStatus.COMPLETED
        diagnostic.current_question_id = None
        failed = [step for step in diagnostic.path if not step.is_correct]
        root_topic = failed[-1].topic if failed else None
        await self.repository.save_state(diagnostic)
        return DiagnosticAnswerResult(is_correct, "finished", result=DiagnosticResult(root_topic, diagnostic.path.copy()))

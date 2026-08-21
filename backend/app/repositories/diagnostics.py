from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.domain.diagnostics import Diagnostic, DiagnosticAnswer, DiagnosticQuestion, DiagnosticStatus
from app.domain.topics import Topic
from app.repositories.topics import SubjectRecord, TopicPrerequisiteRecord, TopicRecord
from app.repositories.users import StudentRecord


class DiagnosticRecord(Base):
    __tablename__ = "diagnostics"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    student_id: Mapped[UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    subject_id: Mapped[UUID] = mapped_column(ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False)
    target_grade: Mapped[int] = mapped_column(nullable=False)
    status: Mapped[DiagnosticStatus] = mapped_column(String(20), nullable=False, default=DiagnosticStatus.IN_PROGRESS)
    current_question_id: Mapped[UUID | None] = mapped_column(nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DiagnosticQuestionRecord(Base):
    __tablename__ = "diagnostic_questions"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    diagnostic_id: Mapped[UUID] = mapped_column(ForeignKey("diagnostics.id", ondelete="CASCADE"), nullable=False)
    topic_id: Mapped[UUID] = mapped_column(ForeignKey("topics.id", ondelete="RESTRICT"), nullable=False)
    text: Mapped[str] = mapped_column(String(1000), nullable=False)
    options: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    correct_index: Mapped[int] = mapped_column(Integer, nullable=False)


class DiagnosticAnswerRecord(Base):
    __tablename__ = "diagnostic_answers"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    diagnostic_id: Mapped[UUID] = mapped_column(ForeignKey("diagnostics.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[UUID] = mapped_column(ForeignKey("diagnostic_questions.id", ondelete="RESTRICT"), nullable=False)
    answer: Mapped[str] = mapped_column(String(500), nullable=False)
    is_correct: Mapped[bool] = mapped_column(nullable=False)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class DiagnosticQuestionTemplateRecord(Base):
    __tablename__ = "diagnostic_question_templates"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    topic_id: Mapped[UUID] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), unique=True, nullable=False)
    text: Mapped[str] = mapped_column(String(1000), nullable=False)
    options: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    correct_index: Mapped[int] = mapped_column(Integer, nullable=False)


class SqlAlchemyDiagnosticRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @asynccontextmanager
    async def transaction(self):
        async with self.session.begin():
            yield

    async def get_student_id(self, user_id: UUID) -> UUID | None:
        return await self.session.scalar(select(StudentRecord.id).where(StudentRecord.user_id == user_id))

    async def start(self, student_id: UUID, subject_code: str, grade: int) -> tuple[Diagnostic, DiagnosticQuestion] | None:
        subject = await self.session.scalar(select(SubjectRecord).where(SubjectRecord.code == subject_code))
        if subject is None:
            return None
        starting_topic = await self.session.scalar(select(TopicRecord).where(TopicRecord.subject_id == subject.id, TopicRecord.grade == grade).order_by(TopicRecord.title))
        if starting_topic is None:
            return None
        record = DiagnosticRecord(student_id=student_id, subject_id=subject.id, target_grade=grade, status=DiagnosticStatus.IN_PROGRESS)
        self.session.add(record)
        await self.session.flush()
        topic, first_question, visited = starting_topic, None, set()
        while topic.id not in visited:
            visited.add(topic.id)
            template = await self.session.scalar(select(DiagnosticQuestionTemplateRecord).where(DiagnosticQuestionTemplateRecord.topic_id == topic.id))
            if template is None:
                return None
            question = DiagnosticQuestionRecord(diagnostic_id=record.id, topic_id=topic.id, text=template.text, options=template.options, correct_index=template.correct_index)
            self.session.add(question)
            await self.session.flush()
            first_question = first_question or question
            prerequisite = await self.session.scalar(select(TopicRecord).join(TopicPrerequisiteRecord, TopicPrerequisiteRecord.prerequisite_topic_id == TopicRecord.id).where(TopicPrerequisiteRecord.topic_id == topic.id).order_by(TopicRecord.grade.desc(), TopicRecord.title))
            if prerequisite is None:
                break
            topic = prerequisite
        if first_question is None:
            return None
        record.current_question_id = first_question.id
        return self._to_domain(record), self._question_to_domain(first_question, starting_topic)

    async def get_for_student(self, diagnostic_id: UUID, student_id: UUID, *, lock: bool = False) -> Diagnostic | None:
        statement = select(DiagnosticRecord).where(DiagnosticRecord.id == diagnostic_id, DiagnosticRecord.student_id == student_id)
        if lock:
            statement = statement.with_for_update()
        record = await self.session.scalar(statement)
        return self._to_domain(record) if record else None

    async def get_question(self, question_id: UUID) -> DiagnosticQuestion | None:
        result = (await self.session.execute(select(DiagnosticQuestionRecord, TopicRecord).join(TopicRecord, TopicRecord.id == DiagnosticQuestionRecord.topic_id).where(DiagnosticQuestionRecord.id == question_id))).one_or_none()
        return self._question_to_domain(*result) if result else None

    async def get_question_for_diagnostic_topic(self, diagnostic_id: UUID, topic_id: UUID) -> DiagnosticQuestion | None:
        result = (await self.session.execute(select(DiagnosticQuestionRecord, TopicRecord).join(TopicRecord, TopicRecord.id == DiagnosticQuestionRecord.topic_id).where(DiagnosticQuestionRecord.diagnostic_id == diagnostic_id, DiagnosticQuestionRecord.topic_id == topic_id))).one_or_none()
        return self._question_to_domain(*result) if result else None

    async def get_prerequisites(self, topic_id: UUID) -> list[Topic]:
        records = (await self.session.scalars(select(TopicRecord).join(TopicPrerequisiteRecord, TopicPrerequisiteRecord.prerequisite_topic_id == TopicRecord.id).where(TopicPrerequisiteRecord.topic_id == topic_id).order_by(TopicRecord.grade.desc(), TopicRecord.title))).all()
        return [self._topic_to_domain(record) for record in records]

    async def add_answer(self, answer: DiagnosticAnswer) -> None:
        self.session.add(DiagnosticAnswerRecord(diagnostic_id=answer.diagnostic_id, question_id=answer.question_id, answer=answer.answer, is_correct=answer.is_correct, answered_at=answer.answered_at))

    async def save_state(self, diagnostic: Diagnostic) -> None:
        record = await self.session.get(DiagnosticRecord, diagnostic.id)
        if record:
            record.status, record.current_question_id = diagnostic.status, diagnostic.current_question_id
            if diagnostic.status is DiagnosticStatus.COMPLETED:
                record.completed_at = datetime.now(UTC)

    @staticmethod
    def _topic_to_domain(record: TopicRecord) -> Topic:
        return Topic(record.id, record.subject_id, record.title, record.grade, record.source_ref)

    def _question_to_domain(self, question: DiagnosticQuestionRecord, topic: TopicRecord) -> DiagnosticQuestion:
        return DiagnosticQuestion(question.id, question.diagnostic_id, self._topic_to_domain(topic), question.text, question.options, question.correct_index)

    @staticmethod
    def _to_domain(record: DiagnosticRecord) -> Diagnostic:
        return Diagnostic(record.id, record.student_id, record.subject_id, record.target_grade, DiagnosticStatus(record.status), record.current_question_id, record.started_at)

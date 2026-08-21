from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.core.errors import ForbiddenError
from app.domain.diagnostics import DiagnosticPathStep, DiagnosticResult
from app.domain.progress import StudentTopicProgress
from app.domain.topics import Topic
from app.services.learning_plan import LearningPlanService
from app.services.progress import ProgressService
from app.services.rag import RagService
from app.services.teacher import TeacherService


def topic(title: str, grade: int) -> Topic:
    return Topic(id=uuid4(), subject_id=uuid4(), title=title, grade=grade, source_ref="Учебник")


def test_learning_plan_starts_at_deepest_failed_topic() -> None:
    advanced, foundation = topic("Уравнения", 8), topic("Дроби", 5)
    result = DiagnosticResult(foundation, [DiagnosticPathStep(advanced, False), DiagnosticPathStep(foundation, False)])

    assert LearningPlanService().topics_from_diagnostic(result) == [foundation, advanced]


def test_learning_plan_is_empty_when_diagnostic_has_no_gap() -> None:
    result = DiagnosticResult(None, [])

    assert LearningPlanService().topics_from_diagnostic(result) == []


def test_progress_mastery_is_zero_without_attempts() -> None:
    progress = StudentTopicProgress(uuid4(), uuid4(), 0, 0, 0, 0, 0, None)

    assert ProgressService.mastery(progress) == 0


def test_progress_mastery_uses_correct_attempt_rate() -> None:
    progress = StudentTopicProgress(uuid4(), uuid4(), 0, 3, 2, 0, 0, None)

    assert ProgressService.mastery(progress) == 67


def test_teacher_service_blocks_other_teacher() -> None:
    with pytest.raises(ForbiddenError):
        TeacherService.ensure_class_owner(uuid4(), uuid4())


class FakeStudents:
    def __init__(self, student_id) -> None:
        self.student_id = student_id

    async def get_by_user_id(self, user_id):
        return SimpleNamespace(id=self.student_id)


@pytest.mark.asyncio
async def test_plan_and_progress_services_accept_only_the_current_student() -> None:
    student_id = uuid4()

    await LearningPlanService(FakeStudents(student_id)).ensure_student_owner(uuid4(), student_id)
    await ProgressService(FakeStudents(student_id)).ensure_student_owner(uuid4(), student_id)


class FakeTeachers:
    def __init__(self, teacher_id) -> None:
        self.teacher_id = teacher_id

    async def get_by_user_id(self, user_id):
        return SimpleNamespace(id=self.teacher_id)


class FakeClasses:
    def __init__(self, teacher_id) -> None:
        self.teacher_id = teacher_id

    async def get_by_id(self, class_id):
        return SimpleNamespace(teacher_id=self.teacher_id)


@pytest.mark.asyncio
async def test_teacher_service_resolves_class_ownership_server_side() -> None:
    teacher_id = uuid4()

    await TeacherService(FakeTeachers(teacher_id), FakeClasses(teacher_id)).ensure_class_owner_for_user(uuid4(), uuid4())


class FakeGeminiGateway:
    async def embed_query(self, text: str) -> list[float]:
        return [1.0, 0.0]

    async def generate(self, prompt: str) -> str:
        return prompt


@pytest.mark.asyncio
async def test_rag_keeps_only_chunks_above_similarity_threshold() -> None:
    from app.domain.knowledge import KnowledgeChunk, KnowledgeSource

    source = KnowledgeSource(uuid4(), "Математика", "§1", 1, "фрагмент")
    relevant = KnowledgeChunk(uuid4(), source.document_id, "дроби", [1.0, 0.0], source)
    unrelated = KnowledgeChunk(uuid4(), source.document_id, "история", [0.0, 1.0], source)

    found = await RagService(FakeGeminiGateway(), 0.6).relevant_chunks("дроби", [unrelated, relevant])

    assert found == [relevant]

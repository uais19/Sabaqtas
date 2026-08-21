"""Seed the diagnostic chain represented by the current frontend mocks."""

import asyncio

from sqlalchemy import select

from app.core.db import get_session_factory
from app.repositories.diagnostics import DiagnosticQuestionTemplateRecord
from app.repositories.topics import SubjectRecord, TopicPrerequisiteRecord, TopicRecord

TOPICS = [
    ("Квадратные уравнения", 8, "Алгебра, 8 класс, стр. 52", "Решите уравнение: x² − 5x + 6 = 0", ["x = 1 и x = 6", "x = 2 и x = 3", "x = −2 и x = −3", "x = 5 и x = 6"], 1),
    ("Формулы сокращённого умножения", 7, "Алгебра, 7 класс, часть 2, §32, стр. 187", "Раскройте скобки: (a − 4)²", ["a² − 16", "a² + 8a + 16", "a² − 4a + 16", "a² − 8a + 16"], 3),
    ("Сложение рациональных чисел с разными знаками", 6, "Математика, 6 класс, часть 1, §13, стр. 96", "Вычислите: −7 + 3", ["−4", "4", "−10", "10"], 0),
    ("Сложение и вычитание обыкновенных дробей", 5, "Математика, 5 класс, часть 1, §23, стр. 112", "Вычислите: 2/3 + 1/6", ["3/9", "1/2", "5/6", "3/6"], 2),
]


async def seed() -> None:
    async with get_session_factory()() as session, session.begin():
        subject = await session.scalar(select(SubjectRecord).where(SubjectRecord.code == "math"))
        if subject is None:
            subject = SubjectRecord(code="math", title="Математика")
            session.add(subject)
            await session.flush()
        records = []
        for title, grade, source_ref, text, options, correct_index in TOPICS:
            topic = await session.scalar(select(TopicRecord).where(TopicRecord.subject_id == subject.id, TopicRecord.title == title))
            if topic is None:
                topic = TopicRecord(subject_id=subject.id, title=title, grade=grade, source_ref=source_ref)
                session.add(topic)
                await session.flush()
            template = await session.scalar(select(DiagnosticQuestionTemplateRecord).where(DiagnosticQuestionTemplateRecord.topic_id == topic.id))
            if template is None:
                session.add(DiagnosticQuestionTemplateRecord(topic_id=topic.id, text=text, options=options, correct_index=correct_index))
            records.append(topic)
        for topic, prerequisite in zip(records, records[1:], strict=True):
            exists = await session.scalar(select(TopicPrerequisiteRecord).where(TopicPrerequisiteRecord.topic_id == topic.id, TopicPrerequisiteRecord.prerequisite_topic_id == prerequisite.id))
            if exists is None:
                session.add(TopicPrerequisiteRecord(topic_id=topic.id, prerequisite_topic_id=prerequisite.id))
    print("Seeded diagnostic topics and question templates.")


if __name__ == "__main__":
    asyncio.run(seed())

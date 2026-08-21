from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class KnowledgeSource:
    document_id: UUID
    book: str
    paragraph: str | None
    page: int | None
    snippet: str


@dataclass(frozen=True)
class KnowledgeChunk:
    id: UUID
    document_id: UUID
    text: str
    embedding: list[float]
    source: KnowledgeSource

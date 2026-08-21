from math import sqrt
from typing import Protocol

from app.domain.knowledge import KnowledgeChunk


class GeminiGateway(Protocol):
    async def embed_query(self, text: str) -> list[float]: ...
    async def generate(self, prompt: str) -> str: ...


class RagService:
    def __init__(self, gateway: GeminiGateway, threshold: float) -> None:
        self.gateway = gateway
        self.threshold = threshold

    async def relevant_chunks(self, question: str, chunks: list[KnowledgeChunk]) -> list[KnowledgeChunk]:
        query = self._normalize(await self.gateway.embed_query(question))
        scored = sorted(((self._dot(query, chunk.embedding), chunk) for chunk in chunks), reverse=True, key=lambda item: item[0])
        return [chunk for score, chunk in scored[:5] if score >= self.threshold]

    @staticmethod
    def _normalize(vector: list[float]) -> list[float]:
        length = sqrt(sum(value * value for value in vector))
        return [value / length for value in vector] if length else vector

    @staticmethod
    def _dot(left: list[float], right: list[float]) -> float:
        return sum(a * b for a, b in zip(left, right, strict=True))

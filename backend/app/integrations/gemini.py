from typing import cast

from app.core.config import get_settings
from app.core.errors import ServiceUnavailableError


class GeminiClient:
    """The only integration point for the official Google GenAI SDK."""

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.gemini_api_key:
            raise ServiceUnavailableError("GEMINI_API_KEY is not configured")
        from google import genai  # type: ignore[import-not-found]

        self.client = genai.Client(api_key=settings.gemini_api_key)

    async def embed_query(self, text: str) -> list[float]:
        response = await self.client.aio.models.embed_content(
            model="gemini-embedding-2",
            contents=text,
            config={"task_type": "RETRIEVAL_QUERY", "output_dimensionality": 768},
        )
        return list(response.embeddings[0].values)

    async def generate(self, prompt: str) -> str:
        response = await self.client.aio.models.generate_content(
            model="gemini-3.5-flash", contents=prompt, config={"temperature": 0.2}
        )
        if not response.text:
            raise ServiceUnavailableError("Gemini returned an empty response")
        return cast(str, response.text)

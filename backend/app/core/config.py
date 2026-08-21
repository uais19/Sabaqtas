from functools import lru_cache

from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Sabaqtas Backend"
    environment: str = "development"
    database_url: PostgresDsn | None = None
    jwt_secret: str | None = Field(default=None, repr=False)
    jwt_algorithm: str = "HS256"
    gemini_api_key: str | None = Field(default=None, repr=False)
    cors_origins: list[str] = ["http://localhost:8000", "http://127.0.0.1:8000"]
    rag_similarity_threshold: float = Field(default=0.6, ge=-1, le=1)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()

from typing import Literal

from pydantic import Field

from app.schemas.common import ApiModel


class ChatRequest(ApiModel):
    question: str = Field(min_length=1, max_length=1000)
    mode: Literal["explain", "mentor"] = "explain"
    language: Literal["ru", "kk"] = "ru"
    grade: int = Field(default=9, ge=1, le=12)


class SourceResponse(ApiModel):
    book: str
    paragraph: str | None
    page: int | None
    snippet: str


class ChatResponse(ApiModel):
    answer: str
    found: bool
    sources: list[SourceResponse]


class MentorReplyRequest(ApiModel):
    task_id: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=1000)


class MentorReplyResponse(ApiModel):
    reply: str
    hints_count: int
    solved: bool

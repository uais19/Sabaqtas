from fastapi import APIRouter

from app.schemas.chat import ChatRequest, ChatResponse, MentorReplyRequest, MentorReplyResponse

router = APIRouter(tags=["chat"])


@router.post("/ask", response_model=ChatResponse)
async def ask(request: ChatRequest) -> ChatResponse:
    """RAG delivery awaits imported textbook chunks; it never falls back to model-only answers."""
    return ChatResponse(answer="Этого нет в загруженных учебниках.", found=False, sources=[])


@router.post("/mentor/reply", response_model=MentorReplyResponse)
async def mentor_reply(request: MentorReplyRequest) -> MentorReplyResponse:
    return MentorReplyResponse(reply="Этого нет в загруженных учебниках.", hints_count=0, solved=False)

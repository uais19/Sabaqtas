from fastapi import APIRouter

from app.api.v1 import auth, chat, diagnostic, health, plan, progress, teacher

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(diagnostic.router)
api_router.include_router(chat.router)
api_router.include_router(plan.router)
api_router.include_router(progress.router)
api_router.include_router(teacher.router)

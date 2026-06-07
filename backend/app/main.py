from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.features.activity.router import router as activity_router
from app.features.albums.router import router as albums_router
from app.features.chat.router import router as chat_router
from app.features.announces.router import router as announces_router
from app.features.auth.router import router as auth_router
from app.features.homes.router import router as homes_router
from app.features.posts.router import router as posts_router
from app.features.reminders.router import router as reminders_router
from app.features.schedule.router import router as schedule_router
from app.features.todos.router import router as todos_router
from app.utils.fcm import init_firebase


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.MEDIA_ROOT).mkdir(parents=True, exist_ok=True)
    init_firebase()
    yield


app = FastAPI(
    title="Tomo-sumi API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory=settings.MEDIA_ROOT), name="media")

app.include_router(auth_router, prefix="/api/auth", tags=["認証"])
app.include_router(homes_router, prefix="/api/homes", tags=["ホーム管理"])
app.include_router(albums_router, prefix="/api/albums", tags=["アルバム"])
app.include_router(chat_router, prefix="/api/chat", tags=["チャット"])
app.include_router(announces_router, prefix="/api/announces", tags=["お知らせ"])
app.include_router(schedule_router, prefix="/api/schedules", tags=["スケジュール"])
app.include_router(todos_router, prefix="/api/todos", tags=["TODOリスト"])
app.include_router(posts_router, prefix="/api/posts", tags=["投稿・SNS"])
app.include_router(reminders_router, prefix="/api/reminders", tags=["リマインダー"])
app.include_router(activity_router, prefix="/api/activity", tags=["アクティビティ"])

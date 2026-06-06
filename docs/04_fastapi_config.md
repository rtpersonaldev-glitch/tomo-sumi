# FastAPI構成

## 技術スタック

| 項目 | パッケージ | バージョン | 用途 |
|------|----------|----------|------|
| フレームワーク | `fastapi` | ^0.115 | WebフレームワークコアとWebSocket |
| ASGIサーバー | `uvicorn[standard]` | ^0.32 | 本番・開発サーバー |
| ORM | `sqlalchemy[asyncio]` | ^2.0 | 非同期DB操作 |
| マイグレーション | `alembic` | ^1.14 | DBスキーマ管理 |
| DBドライバー | `asyncpg` | ^0.30 | 非同期PostgreSQLドライバー |
| バリデーション | `pydantic` | ^2.10 | スキーマ定義・バリデーション |
| 設定管理 | `pydantic-settings` | ^2.7 | 環境変数の型安全な読み込み |
| JWT | `python-jose[cryptography]` | ^3.3 | JWTトークン生成・検証 |
| パスワード | `passlib[bcrypt]` | ^1.7 | パスワードハッシュ |
| ファイル | `python-multipart` | ^0.0.20 | ファイルアップロード |
| タスク | `celery` | ^5.4 | 非同期タスクキュー |
| Redis | `redis` | ^5.2 | Celeryブローカー |
| Firebase | `firebase-admin` | ^6.7 | FCMプッシュ通知 |
| 画像 | `pillow` | ^11.0 | 画像処理 |
| HTTP | `httpx` | ^0.27 | テスト用HTTPクライアント |
| テスト | `pytest-asyncio` | ^0.23 | 非同期テスト |

---

## pyproject.toml

```toml
[tool.poetry]
name = "tomo-sumi-backend"
version = "0.1.0"
description = "家族共有ホーム管理アプリ バックエンド"
python = "^3.12"

[tool.poetry.dependencies]
fastapi = "^0.115"
uvicorn = {extras = ["standard"], version = "^0.32"}
sqlalchemy = {extras = ["asyncio"], version = "^2.0"}
alembic = "^1.14"
asyncpg = "^0.30"
psycopg2-binary = "^2.9"
pydantic = "^2.10"
pydantic-settings = "^2.7"
python-jose = {extras = ["cryptography"], version = "^3.3"}
passlib = {extras = ["bcrypt"], version = "^1.7"}
python-multipart = "^0.0.20"
celery = {extras = ["redis"], version = "^5.4"}
redis = "^5.2"
firebase-admin = "^6.7"
pillow = "^11.0"
python-dotenv = "^1.1"

[tool.poetry.group.dev.dependencies]
pytest = "^8.0"
pytest-asyncio = "^0.23"
httpx = "^0.27"
factory-boy = "^3.3"
ruff = "^0.8"
mypy = "^1.13"

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP"]

[tool.mypy]
python_version = "3.12"
strict = true
ignore_missing_imports = true

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

---

## アプリケーションエントリーポイント（app/main.py）

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine
from app.models.base import Base

# 各機能のルーターをインポート
from app.features.auth.router import router as auth_router
from app.features.homes.router import router as homes_router
from app.features.announces.router import router as announces_router
from app.features.albums.router import router as albums_router
from app.features.todos.router import router as todos_router
from app.features.reminders.router import router as reminders_router
from app.features.posts.router import router as posts_router
from app.features.chat.router import router as chat_router
from app.features.schedule.router import router as schedule_router
from app.features.costs.router import router as costs_router
from app.features.activity.router import router as activity_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 起動時処理（Firebase初期化等）
    yield
    # 終了時処理


app = FastAPI(
    title="Tomo-sumi API",
    version="1.0.0",
    lifespan=lifespan,
    # 本番環境ではdocs_urlをNoneにする
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

# メディアファイルの静的配信
app.mount("/media", StaticFiles(directory="media"), name="media")

# 全ルーター登録（プレフィックス /api）
app.include_router(auth_router,      prefix="/api/auth",      tags=["認証"])
app.include_router(homes_router,     prefix="/api/homes",     tags=["ホーム"])
app.include_router(announces_router, prefix="/api/announces", tags=["お知らせ"])
app.include_router(albums_router,    prefix="/api/albums",    tags=["アルバム"])
app.include_router(todos_router,     prefix="/api/todos",     tags=["TODO"])
app.include_router(reminders_router, prefix="/api/reminders", tags=["リマインダー"])
app.include_router(posts_router,     prefix="/api/posts",     tags=["投稿"])
app.include_router(chat_router,      prefix="/api/chat",      tags=["チャット"])
app.include_router(schedule_router,  prefix="/api/schedules", tags=["スケジュール"])
app.include_router(costs_router,     prefix="/api/costs",     tags=["家計管理"])
app.include_router(activity_router,  prefix="/api/activity",  tags=["アクティビティ"])
```

---

## 設定管理（app/core/config.py）

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # アプリ
    APP_NAME: str = "Tomo-sumi"
    DEBUG: bool = False

    # データベース
    DATABASE_URL: str  # postgresql+asyncpg://user:pass@host:5432/dbname

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # Firebase
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "firebase_service_account.json"

    # メディアファイル
    MEDIA_ROOT: str = "media"
    MEDIA_BASE_URL: str = "http://localhost:8000/media"

settings = Settings()
```

---

## 機能ルーターの構造（features/*/router.py パターン）

```python
# app/features/announces/router.py の例

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_home
from app.models.user import User
from app.models.home import Home
from app.features.announces.service import AnnounceService
from app.features.announces.schemas import (
    AnnounceListResponse,
    AnnounceDetailResponse,
    AnnounceCreateRequest,
    AnnounceUpdateRequest,
)

router = APIRouter()


@router.get("/{home_id}", response_model=list[AnnounceListResponse])
async def list_announces(
    home_id: int,
    search: str | None = Query(None),
    priority: str | None = Query(None),
    ordering: str = Query("-created_at"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await AnnounceService(db).get_list(home_id, search, priority, ordering)


@router.get("/{id}/detail", response_model=AnnounceDetailResponse)
async def get_announce(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await AnnounceService(db).get_by_id(id, current_user.id)


@router.post("", response_model=AnnounceDetailResponse, status_code=201)
async def create_announce(
    body: AnnounceCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_home: Home = Depends(get_current_home),
):
    return await AnnounceService(db).create(body, current_user, current_home)


@router.put("/{id}", response_model=AnnounceDetailResponse)
async def update_announce(
    id: int,
    body: AnnounceUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await AnnounceService(db).update(id, body, current_user)


@router.post("/{id}/like", response_model=dict)
async def toggle_like(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await AnnounceService(db).toggle_like(id, current_user.id)


@router.post("/{id}/push", status_code=204)
async def push_announce(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_home: Home = Depends(get_current_home),
):
    await AnnounceService(db).send_push(id, current_home)
```

---

## サービス層の構造（features/*/service.py パターン）

```python
# app/features/announces/service.py の例

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models.announce import Announce, AnnounceLike
from app.models.user import User
from app.models.home import Home
from app.features.announces.schemas import AnnounceCreateRequest, AnnounceUpdateRequest
from app.utils.fcm import send_push_to_home


class AnnounceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_list(
        self, home_id: int, search: str | None, priority: str | None, ordering: str
    ) -> list[Announce]:
        query = select(Announce).where(Announce.home_id == home_id)
        if search:
            query = query.where(Announce.title.ilike(f"%{search}%"))
        if priority:
            query = query.where(Announce.priority == priority)
        query = query.order_by(desc(Announce.created_at))
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_by_id(self, id: int, user_id: int) -> Announce:
        announce = await self.db.get(Announce, id)
        if not announce:
            raise HTTPException(status_code=404, detail="Announce not found")
        return announce

    async def create(
        self, body: AnnounceCreateRequest, user: User, home: Home
    ) -> Announce:
        announce = Announce(**body.model_dump(), home_id=home.id, created_by=user.id)
        self.db.add(announce)
        await self.db.flush()
        return announce

    async def toggle_like(self, announce_id: int, user_id: int) -> dict:
        existing = await self.db.execute(
            select(AnnounceLike).where(
                AnnounceLike.announce_id == announce_id,
                AnnounceLike.user_id == user_id,
            )
        )
        like = existing.scalar_one_or_none()
        if like:
            await self.db.delete(like)
            return {"liked": False}
        else:
            self.db.add(AnnounceLike(announce_id=announce_id, user_id=user_id))
            return {"liked": True}
```

---

## 依存関係（app/core/dependencies.py）

> 実装の詳細は **[06_auth_config.md](06_auth_config.md)** を参照してください。

主な依存関係関数：

| 関数 | 用途 | エラー |
|------|------|--------|
| `get_current_user` | JWT検証 → Userオブジェクト取得 | 未認証: 401 |
| `get_current_home` | JWTのhome_id → Homeオブジェクト取得 | ホーム未選択: 403 |
| `get_db` | 非同期DBセッション取得 | - |

```python
# 使い方（router.pyでの典型パターン）
from app.core.dependencies import get_current_user, get_current_home
from app.core.database import get_db

@router.get("/{home_id}")
async def list_items(
    home_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),    # ユーザーログイン必須
):
    ...

@router.post("")
async def create_item(
    body: CreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_home: Home = Depends(get_current_home),    # ホーム選択必須
):
    ...
```

---

## WebSocket（app/features/chat/）

```python
# app/features/chat/connection_manager.py

from collections import defaultdict
from fastapi import WebSocket


class ChatConnectionManager:
    def __init__(self):
        self._connections: dict[int, list[WebSocket]] = defaultdict(list)

    async def connect(self, home_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[home_id].append(websocket)

    def disconnect(self, home_id: int, websocket: WebSocket) -> None:
        self._connections[home_id].remove(websocket)

    async def broadcast(self, home_id: int, message: dict) -> None:
        for ws in self._connections[home_id]:
            await ws.send_json(message)


manager = ChatConnectionManager()


# app/features/chat/router.py（WebSocket部分）
@router.websocket("/ws/{home_id}")
async def chat_websocket(
    home_id: int,
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db),
):
    await manager.connect(home_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            # DBに保存
            msg = await ChatService(db).save_message(home_id, data)
            # 全メンバーにブロードキャスト
            await manager.broadcast(home_id, msg.model_dump())
    except WebSocketDisconnect:
        manager.disconnect(home_id, websocket)
```

---

## Celery設定（app/tasks/celery_app.py）

```python
from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "tomo_sumi",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.cost_tasks", "app.tasks.reminder_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Tokyo",
    enable_utc=True,
    beat_schedule={
        "monthly-settlement": {
            "task": "app.tasks.cost_tasks.run_monthly_settlement",
            "schedule": crontab(minute=59, hour=23),
        },
    },
)
```

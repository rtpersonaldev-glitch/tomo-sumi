import os

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import get_db
from app.main import app
from app.models.base import Base

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://tomo:tomo@db:5432/tomo_test",
)


@pytest_asyncio.fixture(autouse=True)
async def db_engine():
    """テストごとに新しいエンジンを作成してイベントループ競合を回避する"""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db(db_engine) -> AsyncSession:
    async with db_engine() as session:
        yield session


@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncClient:
    app.dependency_overrides[get_db] = lambda: db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient) -> AsyncClient:
    """認証済みクライアント（ユーザーログイン + ホーム選択済み）"""
    await client.post(
        "/api/auth/register",
        json={
            "email": "auth_fixture@example.com",
            "password": "TestPass123!",
            "nickname": "フィクスチャユーザー",
        },
    )
    await client.post(
        "/api/auth/login",
        json={"email": "auth_fixture@example.com", "password": "TestPass123!"},
    )
    resp = await client.post("/api/homes", json={"name": "フィクスチャホーム"})
    home_id = resp.json()["id"]
    await client.post(f"/api/auth/home-login/{home_id}")
    return client

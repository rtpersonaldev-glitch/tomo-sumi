# テスト方針

## 方針概要

| 対象 | ツール | 方針 |
|------|--------|------|
| バックエンドAPI | pytest + httpx | 全エンドポイントの結合テスト |
| バックエンドサービス | pytest | ビジネスロジックのユニットテスト |
| フロントエンド | TypeScript（typecheck） | 型エラーゼロを維持 |
| E2E（任意） | Playwright | 主要フローのみ |

---

## バックエンドテスト構成

### conftest.py（テスト用DBセッション）

```python
# tests/conftest.py

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.core.database import get_db
from app.models.base import Base

# テスト用インメモリDB（SQLite / または PostgreSQL テスト用DB）
TEST_DATABASE_URL = "postgresql+asyncpg://tomo:tomo@localhost:5432/tomo_test"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db() -> AsyncSession:
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncClient:
    # テスト用のDB依存関係に上書き
    app.dependency_overrides[get_db] = lambda: db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient, db: AsyncSession) -> AsyncClient:
    """認証済みクライアント（ユーザーログイン + ホーム選択済み）"""
    # ユーザー作成
    await client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "TestPass123!",
        "nickname": "テストユーザー",
    })
    # ログイン
    await client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "TestPass123!",
    })
    # ホーム作成
    resp = await client.post("/api/homes", json={"name": "テストホーム"})
    home_id = resp.json()["id"]
    # ホーム選択
    await client.post(f"/api/auth/home-login/{home_id}")
    return client
```

### テスト実装パターン

```python
# tests/features/test_announces.py

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_announce(auth_client: AsyncClient):
    """お知らせを作成できる"""
    response = await auth_client.post("/api/announces", json={
        "title": "テストお知らせ",
        "content": "テスト本文",
        "priority": "high",
        "end_date": "2026-12-31",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "テストお知らせ"
    assert data["priority"] == "high"


@pytest.mark.asyncio
async def test_list_announces(auth_client: AsyncClient):
    """お知らせ一覧を取得できる"""
    # 事前データ作成
    await auth_client.post("/api/announces", json={
        "title": "お知らせ1", "content": "内容", "priority": "low", "end_date": "2026-12-31",
    })
    await auth_client.post("/api/announces", json={
        "title": "お知らせ2", "content": "内容", "priority": "high", "end_date": "2026-12-31",
    })

    # ホームIDが必要なので取得
    me = await auth_client.get("/api/auth/me")
    home_id = me.json()["home"]["id"]

    response = await auth_client.get(f"/api/announces/{home_id}")
    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.asyncio
async def test_announce_not_found(auth_client: AsyncClient):
    """存在しないお知らせは404を返す"""
    response = await auth_client.get("/api/announces/99999/detail")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_toggle_like(auth_client: AsyncClient):
    """いいねをON/OFF切り替えできる"""
    create_resp = await auth_client.post("/api/announces", json={
        "title": "いいねテスト", "content": "内容", "priority": "medium", "end_date": "2026-12-31",
    })
    announce_id = create_resp.json()["id"]

    # いいね
    like_resp = await auth_client.post(f"/api/announces/{announce_id}/like")
    assert like_resp.json()["liked"] is True

    # いいね解除
    unlike_resp = await auth_client.post(f"/api/announces/{announce_id}/like")
    assert unlike_resp.json()["liked"] is False


@pytest.mark.asyncio
async def test_create_announce_requires_auth(client: AsyncClient):
    """未認証ではお知らせを作成できない"""
    response = await client.post("/api/announces", json={
        "title": "テスト", "content": "内容", "priority": "low", "end_date": "2026-12-31",
    })
    assert response.status_code == 401
```

### テスト実行

```bash
# 全テスト
docker compose -f docker-compose.dev.yml exec backend pytest tests/ -v

# 特定機能のみ
docker compose -f docker-compose.dev.yml exec backend pytest tests/features/test_announces.py -v

# カバレッジ付き
docker compose -f docker-compose.dev.yml exec backend pytest tests/ --cov=app --cov-report=term-missing
```

---

## テスト優先度

### 必ず書く（高優先度）

| テスト対象 | 理由 |
|-----------|------|
| 認証フロー | ログイン・トークンリフレッシュ・ホーム選択 |
| 月末清算ロジック | ビジネスロジックが最複雑 |
| リマインダータスク | 繰り返しパターンが多い |
| 家計管理CRUD | データの正確性が重要 |

### 書くと望ましい（中優先度）

- お知らせ・アルバム・TODO・スケジュールのCRUD
- いいね・コメントのトグル系

### 任意（低優先度）

- チャット（WebSocketはテストが複雑）
- FCM通知（外部サービス依存）

---

## フロントエンドの型チェック

```bash
# TypeScriptコンパイルエラーをゼロに保つ
cd frontend && npm run typecheck

# Lintチェック
cd frontend && npm run lint
```

### CI/CDで自動実行する内容

```yaml
# .github/workflows/ci.yml（例）
- name: バックエンドテスト
  run: docker compose exec backend pytest tests/ --tb=short

- name: フロントエンド型チェック
  run: cd frontend && npm run typecheck

- name: フロントエンドLint
  run: cd frontend && npm run lint
```

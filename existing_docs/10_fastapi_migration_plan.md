# FastAPIへの移行計画

## 移行の目的・背景

現行のDjangoバックエンド（lifesync-web-backend）をFastAPIへ移植する。  
FastAPIは非同期処理・型安全性・自動ドキュメント生成に優れており、モダンなAPIサーバーとして採用価値が高い。

---

## 技術スタック比較

| 項目 | 現行（Django） | 移行後（FastAPI） |
|------|-------------|----------------|
| フレームワーク | Django 5.1 + DRF | FastAPI |
| ORM | Django ORM | SQLAlchemy（または Tortoise-ORM） |
| マイグレーション | Django Migrations | Alembic |
| 認証 | djangorestframework-simplejwt | python-jose + passlib |
| バリデーション | DRFシリアライザ | Pydantic v2 |
| 非同期処理 | Celery + Redis | Celery（継続） または ARQ |
| WebSocket | Django Channels | FastAPI WebSocket（内蔵）|
| スキーマ定義 | settings.py + models.py | Pydantic schemas + SQLAlchemy models |
| API仕様書 | 手動 | Swagger UI / ReDoc（自動生成） |

---

## 移行方針

### 移行アプローチ

**フェーズ分割による段階的移行**を採用する。  
既存のReactフロントエンドは変更不要（APIのURL・レスポンス形式を維持する）。

---

## フェーズ別移行計画

### フェーズ0：準備・設計（1〜2週間）

- [ ] 移行先のプロジェクト構成を設計
- [ ] Python環境・パッケージ管理方法を決定（Poetry推奨）
- [ ] データベース接続方式を決定（SQLAlchemy + Alembic推奨）
- [ ] 認証方式の詳細設計（JWT + HTTPonly Cookie）
- [ ] 既存DBのER図を整備（本ドキュメント04_db_tables.md を活用）
- [ ] 既存APIの全エンドポイントを整理（本ドキュメント03_api_list.md を活用）
- [ ] テスト方針を決定（pytest + httpx）

**推奨ディレクトリ構成:**

```
lifesync-api/
├── app/
│   ├── main.py              # FastAPIアプリインスタンス
│   ├── core/
│   │   ├── config.py        # 設定（Pydantic BaseSettings）
│   │   ├── security.py      # JWT・パスワードハッシュ
│   │   └── database.py      # DB接続・セッション
│   ├── models/              # SQLAlchemyモデル（既存Django模型から移植）
│   ├── schemas/             # Pydanticスキーマ（DRFシリアライザから移植）
│   ├── routers/             # APIルーター（Djangoのurls.py + views.pyから移植）
│   │   ├── auth.py
│   │   ├── homes.py
│   │   ├── announce.py
│   │   ├── albums.py
│   │   ├── todos.py
│   │   ├── reminders.py
│   │   ├── posts.py
│   │   ├── chat.py
│   │   ├── schedule.py
│   │   ├── cost.py
│   │   └── activity.py
│   ├── services/            # ビジネスロジック（Viewsから分離）
│   ├── tasks/               # Celeryタスク（既存から移植）
│   └── utils/               # ユーティリティ（FCM等）
├── alembic/                 # DBマイグレーション
├── tests/                   # テスト
├── pyproject.toml           # 依存関係管理（Poetry）
└── .env                     # 環境変数
```

---

### フェーズ1：基盤構築（2〜3週間）

#### 1-1. プロジェクト初期化

```bash
# FastAPIプロジェクト作成
poetry new lifesync-api
cd lifesync-api
poetry add fastapi uvicorn[standard] sqlalchemy alembic psycopg2-binary
poetry add python-jose[cryptography] passlib[bcrypt]
poetry add pydantic-settings python-dotenv
poetry add celery redis firebase-admin pillow
```

#### 1-2. データベース層の構築

- [ ] SQLAlchemyモデルを作成（Django models.pyを参考に32テーブルを再定義）
- [ ] Alembicの初期化・初期マイグレーションを作成
- [ ] 既存PostgreSQLデータベースとの接続確認

**Django → SQLAlchemy モデル変換例:**

```python
# Django（現行）
class Homes(models.Model):
    name = models.CharField(max_length=50)
    homeImage = models.ImageField(upload_to='homeImages/', null=True)

# SQLAlchemy（移行後）
class Home(Base):
    __tablename__ = "homes"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    home_image: Mapped[Optional[str]] = mapped_column(String, nullable=True)
```

#### 1-3. 認証基盤の構築

- [ ] `CustomJWTAuthentication` を FastAPI の `OAuth2PasswordBearer` + python-jose で再実装
- [ ] HTTPonly クッキーでのJWT発行・検証ミドルウェアを実装
- [ ] `get_current_user` 依存関係（Depends）を作成
- [ ] 2段階認証（isUserLogin / isHomeLogin）の再実装

```python
# FastAPI認証依存関係の例
async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> CustomUser:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401)
    payload = verify_token(token)
    user = await db.get(CustomUser, payload["sub"])
    return user
```

---

### フェーズ2：APIエンドポイント移植（3〜4週間）

優先度順に移植する。フロントエンドへの影響が大きい認証・コア機能を先行。

#### 優先度1（必須・先行）

| Django app | FastAPI router | エンドポイント数 |
|-----------|---------------|--------------|
| users | auth.py | 12 |
| homes | homes.py | 7 |
| activity | activity.py | 3 |

#### 優先度2（主要機能）

| Django app | FastAPI router | エンドポイント数 |
|-----------|---------------|--------------|
| announce | announce.py | 6 |
| schedule | schedule.py | 4 |
| todo | todos.py | 4 |
| reminder | reminders.py | 8 |

#### 優先度3（拡張機能）

| Django app | FastAPI router | エンドポイント数 |
|-----------|---------------|--------------|
| post | posts.py | 5 |
| album | albums.py | 4 |
| chat | chat.py | 1 (+WS) |
| cost | cost.py | 17 |

**DRFシリアライザ → Pydanticスキーマ変換例:**

```python
# Django DRFシリアライザ（現行）
class AnnouncesListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announces
        fields = ['id', 'title', 'content', 'priority', 'end_date']

# Pydanticスキーマ（移行後）
class AnnounceResponse(BaseModel):
    id: int
    title: str
    content: str
    priority: str
    end_date: date
    like: bool
    like_count: int

    model_config = ConfigDict(from_attributes=True)
```

---

### フェーズ3：特殊機能の移植（2〜3週間）

#### 3-1. WebSocket（チャット機能）

FastAPIには標準でWebSocketサポートがある。Django Channelsは不要。

```python
# FastAPI WebSocketエンドポイント
@router.websocket("/ws/chat/{home_id}/")
async def websocket_endpoint(websocket: WebSocket, home_id: int):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(home_id, data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
```

#### 3-2. Celeryタスクの移植

既存のCeleryタスクはほぼそのまま移植可能。

- [ ] `cost.tasks.run_month_end_closure` → SQLAlchemy使用に変更
- [ ] `reminder.tasks.send_reminder` → SQLAlchemy使用に変更
- [ ] `django-celery-beat` → `celery-beat`（Redisバックエンド）に変更

#### 3-3. Firebase FCMの移植

```python
# utils/fcm.py（ほぼ変更不要）
from firebase_admin import messaging
import firebase_admin

def send_push_notification(tokens: list[str], title: str, body: str):
    message = messaging.MulticastMessage(
        notification=messaging.Notification(title=title, body=body),
        tokens=tokens,
    )
    messaging.send_multicast(message)
```

#### 3-4. ファイルアップロード（画像処理）

```python
# FastAPIでのファイルアップロード
@router.post("/albums/save/")
async def create_album(
    title: str = Form(...),
    images: list[UploadFile] = File(...),
    current_user: CustomUser = Depends(get_current_user),
):
    # 画像保存処理
    ...
```

---

### フェーズ4：テスト・品質保証（1〜2週間）

- [ ] 全エンドポイントのユニットテスト（pytest + httpx）
- [ ] 既存フロントエンドとの結合テスト
- [ ] パフォーマンステスト（現行との比較）
- [ ] セキュリティレビュー

```toml
# pyproject.toml（テスト依存関係）
[tool.poetry.group.dev.dependencies]
pytest = "^8.0"
pytest-asyncio = "^0.23"
httpx = "^0.27"
factory-boy = "^3.3"
```

---

### フェーズ5：本番移行（1週間）

- [ ] 本番環境へのデプロイ（Docker化推奨）
- [ ] 既存DBへの接続確認（マイグレーション不要・既存DBをそのまま使用）
- [ ] フロントエンドの `REACT_APP_API_HOST` を新しいAPIサーバーに向ける
- [ ] 監視・ログ設定

---

## 主要な移行上の注意点

### 1. フィールド命名規則

DjangoではPythonのスネークケースが一般的だが、既存のDRFシリアライザがキャメルケース（camelCase）で返しているフィールドが存在する（例: `mailaddres`, `nickName`, `notificationFlg`）。

→ **Pydanticの`alias`またはカスタムJSONエンコーダーでキャメルケースを維持すること**。フロントエンドの変更を最小化するため。

### 2. 画像ファイルパス

現行: Django `ImageField` が `media/` ディレクトリを管理  
移行後: FastAPIでは手動でファイル保存・URLを構築する必要がある。  
→ **`media/` ディレクトリ構造（icons/, homeImages/, pictures/ 等）は維持する**

### 3. 権限チェック

`/api/accounts/save/{id}/` は現行 `AllowAny` のため、誰でもユーザー情報を更新できる。  
→ **移行時に `IsAuthenticated` に修正することを推奨**

### 4. パスワードバリデーション

現行の Django 設定では `AUTH_PASSWORD_VALIDATORS` が空で無効化されている。  
→ **FastAPI移行時に `passlib` でパスワードバリデーションを適切に実装すること**

### 5. CustomUser の selectedHome

`CustomUser.selectedHome` はDjango ORMのFKとして定義されているが、セッション的な役割を担っている。  
→ **JWTペイロードにホームIDを含める設計への変更を検討する**

---

## 推奨パッケージ一覧（移行後）

```toml
[tool.poetry.dependencies]
python = "^3.12"
fastapi = "^0.115"
uvicorn = {extras = ["standard"], version = "^0.32"}
sqlalchemy = {extras = ["asyncio"], version = "^2.0"}
alembic = "^1.14"
psycopg2-binary = "^2.9"
asyncpg = "^0.30"          # 非同期PostgreSQLドライバー
pydantic = "^2.10"
pydantic-settings = "^2.7"
python-jose = {extras = ["cryptography"], version = "^3.3"}
passlib = {extras = ["bcrypt"], version = "^1.7"}
python-multipart = "^0.0.20"  # ファイルアップロード
celery = "^5.4"
redis = "^5.2"
firebase-admin = "^6.7"
pillow = "^11.0"
python-dotenv = "^1.1"
```

---

## 移行スケジュール概算

| フェーズ | 内容 | 期間 |
|---------|------|------|
| フェーズ0 | 準備・設計 | 1〜2週間 |
| フェーズ1 | 基盤構築 | 2〜3週間 |
| フェーズ2 | APIエンドポイント移植 | 3〜4週間 |
| フェーズ3 | 特殊機能移植（WS・Celery・FCM） | 2〜3週間 |
| フェーズ4 | テスト・品質保証 | 1〜2週間 |
| フェーズ5 | 本番移行 | 1週間 |
| **合計** | | **10〜15週間** |

---

## 移行のリスクと対策

| リスク | 対策 |
|--------|------|
| フロントエンドとのAPI互換性 | レスポンス形式・URLを完全に維持する（フロント変更なし） |
| 清算ロジックの複雑さ | Celeryタスクのユニットテストを先に整備 |
| ファイルアップロードの互換性 | 既存 `media/` ディレクトリ構造を維持 |
| WebSocketの接続互換性 | 同一エンドポイントパス（`/ws/chat/{homeId}/`）を維持 |
| DBマイグレーション | 既存DBは変更しないため、Alembicで既存スキーマを反映するだけでよい |

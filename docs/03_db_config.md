# DB構成

## 基本情報

| 項目 | 内容 |
|------|------|
| DBMS | PostgreSQL 16 |
| ORM | SQLAlchemy 2.0（Mapped / mapped_column スタイル） |
| マイグレーション | Alembic |
| 非同期ドライバー | asyncpg |
| タイムゾーン | Asia/Tokyo（DBレベルでUTC保存・アプリ層でJST変換） |

---

## DB接続設定（backend/app/core/database.py）

```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

---

## ベースモデル（backend/app/models/base.py）

```python
from datetime import datetime
from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    """全テーブル共通の作成・更新日時カラム"""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
        onupdate=func.now(), nullable=False
    )
    created_by: Mapped[int | None] = mapped_column(nullable=True)
    updated_by: Mapped[int | None] = mapped_column(nullable=True)
```

---

## テーブル定義（SQLAlchemy 2.0形式）

### users テーブル群

```python
# backend/app/models/user.py

class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    icon_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="away", nullable=False)
    # "at_home" | "away"
    notification_flag: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    return_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_active: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    selected_home_id: Mapped[int | None] = mapped_column(ForeignKey("homes.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_staff: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    selected_home: Mapped["Home | None"] = relationship("Home", foreign_keys=[selected_home_id])
    home_links: Mapped[list["HomeLink"]] = relationship("HomeLink", back_populates="user")
    fcm_tokens: Mapped[list["FCMToken"]] = relationship("FCMToken", back_populates="user")

class FCMToken(Base):
    __tablename__ = "fcm_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    token: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="fcm_tokens")
```

### homes テーブル群

```python
# backend/app/models/home.py

class Home(Base, TimestampMixin):
    __tablename__ = "homes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    home_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    home_links: Mapped[list["HomeLink"]] = relationship("HomeLink", back_populates="home")

class HomeLink(Base, TimestampMixin):
    __tablename__ = "home_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="home_links")
    home: Mapped["Home"] = relationship("Home", back_populates="home_links")

class InvitationCode(Base, TimestampMixin):
    __tablename__ = "invitation_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
```

### コスト・清算テーブル群（最複雑）

```python
# backend/app/models/cost.py

class CostCategory(Base, TimestampMixin):
    __tablename__ = "cost_categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(30), nullable=False)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False)

class Cost(Base, TimestampMixin):
    __tablename__ = "costs"
    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False, index=True)
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("cost_categories.id"), nullable=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    payer_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    receipt_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    memo: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    dish_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    seisan_id: Mapped[int | None] = mapped_column(ForeignKey("seisans.id"), nullable=True)

class Seisan(Base, TimestampMixin):
    __tablename__ = "seisans"
    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(50), nullable=False)
    complete_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    settled_date: Mapped[date] = mapped_column(Date, nullable=False)

class SeisanMeisai(Base, TimestampMixin):
    __tablename__ = "seisan_meisai"
    id: Mapped[int] = mapped_column(primary_key=True)
    seisan_id: Mapped[int] = mapped_column(ForeignKey("seisans.id"), nullable=False)
    from_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    to_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    complete_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

class Seikyusaki(Base, TimestampMixin):
    __tablename__ = "seikyusaki"
    id: Mapped[int] = mapped_column(primary_key=True)
    cost_id: Mapped[int] = mapped_column(ForeignKey("costs.id"), nullable=False)
    payer_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    dish_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)

class AutoSeisan(Base, TimestampMixin):
    __tablename__ = "auto_seisans"
    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False, unique=True)
    execute_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    seisan_day: Mapped[int] = mapped_column(Integer, nullable=False)
    # 毎月何日に清算するか（1-31）

class Koteihi(Base, TimestampMixin):
    __tablename__ = "koteihi"
    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("cost_categories.id"), nullable=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    from_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    to_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    memo: Mapped[str] = mapped_column(String(100), nullable=False, default="")
```

---

## テーブル一覧（新DB）

| テーブル名 | 旧テーブル名（Django） | 説明 |
|-----------|------------------|------|
| `users` | `users_customuser` | ユーザー |
| `fcm_tokens` | `users_fcmtoken` | FCMトークン |
| `homes` | `homes_homes` | ホーム |
| `home_links` | `homes_homelinks` | ユーザー・ホーム紐付け |
| `invitation_codes` | `homes_invitationcode` | 招待コード |
| `announces` | `announce_announces` | お知らせ |
| `announce_likes` | `announce_announcelike` | お知らせいいね |
| `albums` | `album_albums` | アルバム |
| `album_pictures` | `album_pictures` | 写真 |
| `todos` | `todo_todos` | TODOリスト |
| `todo_contents` | `todo_todocontents` | TODO項目 |
| `reminders` | `reminder_reminders` | リマインダーグループ |
| `reminder_contents` | `reminder_reminderscontents` | リマインダー内容 |
| `posts` | `post_posts` | 投稿 |
| `post_pictures` | `post_postpictures` | 投稿画像 |
| `post_comments` | `post_postcomments` | 投稿コメント |
| `post_likes` | `post_postlikes` | 投稿いいね |
| `post_tags` | `post_posttags` | 投稿タグ |
| `post_tag_links` | `post_posttaglinks` | 投稿・タグ紐付け |
| `chat_messages` | `chat_chatmessage` | チャットメッセージ |
| `chat_pictures` | `chat_chatpictures` | チャット画像 |
| `chat_reads` | `chat_chatread` | チャット既読 |
| `cost_categories` | `cost_category` | 支出カテゴリ |
| `costs` | `cost_costs` | 支出記録 |
| `seisans` | `cost_seisan` | 清算レコード |
| `seisan_meisai` | `cost_seisanmeisai` | 清算明細 |
| `seikyusaki` | `cost_seikyusaki` | 請求先 |
| `auto_seisans` | `cost_autoseisan` | 自動清算設定 |
| `koteihi` | `cost_koteihi` | 固定費 |
| `schedules` | `schedule_schedules` | スケジュール |
| `activity_logs` | `activity_activitylog` | アクティビティログ |
| `activity_read_status` | `activity_activityreadstatus` | 既読管理 |

---

## Alembicマイグレーション管理

```bash
# 初期化
alembic init alembic

# マイグレーションファイル作成（モデル変更後）
alembic revision --autogenerate -m "add_user_table"

# 最新まで適用
alembic upgrade head

# 1つ戻す
alembic downgrade -1

# 現状確認
alembic current

# 履歴確認
alembic history
```

### alembic/env.py（非同期対応）

```python
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
from app.models.base import Base
from app.core.config import settings
# 全モデルをインポートしてBaseのmetadataに登録する
from app.models import user, home, announce, album, todo, reminder, post, chat, cost, schedule, activity

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("+asyncpg", "+psycopg2"))
target_metadata = Base.metadata
```

---

## インデックス設計方針

- 全FKカラムに自動インデックス
- よく検索されるカラム: `home_id`（全機能テーブル）、`email`（users）、`code`（invitation_codes）
- 複合インデックス: `activity_read_status(user_id, activity_id)`（unique）

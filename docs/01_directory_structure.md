# 新システム ディレクトリ構成

## 設計方針

| 方針 | 内容 |
|------|------|
| **機能ドメイン中心** | レイヤー別ではなく機能別にフォルダを切る。AIが「この機能を変更したい」と思ったとき1フォルダで完結する |
| **1ファイル1責務** | router / service / schema / model を分離。ファイルが小さく読みやすい |
| **明示的な型** | フロント・バックエンド双方で型を省略しない。AIが補完しやすい |
| **命名の一貫性** | ファイル名・関数名・URL・DBカラム名のルールを統一 |

---

## プロジェクト全体構成

```
tomo-sumi/
├── frontend/                   # React + Vite + TypeScript
├── backend/                    # FastAPI + SQLAlchemy 2.0
├── docker/                     # Dockerfile群
├── docker-compose.yml          # 本番用
├── docker-compose.dev.yml      # 開発用
├── docs/                       # 本ドキュメント群
└── existing_docs/              # 既存システムドキュメント（参照用）
```

---

## バックエンド（backend/）

```
backend/
├── app/
│   ├── main.py                     # FastAPIアプリ起動・router登録・CORS設定
│   ├── core/
│   │   ├── config.py               # 全環境変数をPydantic BaseSettingsで定義
│   │   ├── database.py             # AsyncSession・get_db依存関係
│   │   ├── security.py             # JWT発行・検証・パスワードハッシュ
│   │   └── dependencies.py         # get_current_user等の共通Depends
│   │
│   ├── models/                     # SQLAlchemy 2.0 Mapped モデル（全テーブル）
│   │   ├── base.py                 # DeclarativeBase・共通カラム（TimestampMixin）
│   │   ├── user.py                 # User, FCMToken
│   │   ├── home.py                 # Home, HomeLink, InvitationCode
│   │   ├── announce.py             # Announce, AnnounceLike
│   │   ├── album.py                # Album, Picture
│   │   ├── todo.py                 # Todo, TodoContent
│   │   ├── reminder.py             # Reminder, ReminderContent
│   │   ├── post.py                 # Post, PostPicture, PostComment, PostLike, PostTag
│   │   ├── chat.py                 # ChatMessage, ChatPicture, ChatRead
│   │   ├── cost.py                 # Cost, Category, Seisan, SeisanMeisai, ...
│   │   ├── schedule.py             # Schedule
│   │   └── activity.py             # ActivityLog, ActivityReadStatus
│   │
│   ├── features/                   # 機能ドメインごとのAPIロジック
│   │   ├── auth/
│   │   │   ├── router.py           # /api/auth/* エンドポイント定義
│   │   │   ├── service.py          # 認証ビジネスロジック
│   │   │   └── schemas.py          # Pydantic Request/Response スキーマ
│   │   ├── homes/
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   └── schemas.py
│   │   ├── announces/
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   └── schemas.py
│   │   ├── albums/
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   └── schemas.py
│   │   ├── todos/
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   └── schemas.py
│   │   ├── reminders/
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   └── schemas.py
│   │   ├── posts/
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   └── schemas.py
│   │   ├── chat/
│   │   │   ├── router.py           # REST + WebSocket エンドポイント
│   │   │   ├── service.py
│   │   │   ├── schemas.py
│   │   │   └── connection_manager.py  # WebSocket接続管理
│   │   ├── schedule/
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   └── schemas.py
│   │   ├── costs/
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   └── schemas.py
│   │   └── activity/
│   │       ├── router.py
│   │       ├── service.py
│   │       └── schemas.py
│   │
│   ├── tasks/                      # Celery非同期タスク
│   │   ├── celery_app.py           # Celeryアプリ設定
│   │   ├── cost_tasks.py           # 月末自動清算タスク
│   │   └── reminder_tasks.py       # リマインダー通知タスク
│   │
│   └── utils/
│       ├── fcm.py                  # Firebase FCM送信ユーティリティ
│       ├── file_storage.py         # ファイルアップロード・保存
│       └── activity_logger.py      # アクティビティログ記録ユーティリティ
│
├── alembic/                        # DBマイグレーション
│   ├── versions/                   # マイグレーションファイル
│   ├── env.py
│   └── alembic.ini
│
├── tests/
│   ├── conftest.py                 # pytest設定・テスト用DBセッション
│   ├── features/                   # 機能別テスト（featuresと対応）
│   │   ├── test_auth.py
│   │   ├── test_homes.py
│   │   └── ...
│   └── utils/
│       └── factories.py            # テストデータファクトリ
│
├── media/                          # アップロードファイル保存先
│   ├── icons/                      # ユーザーアイコン
│   ├── home_images/                # ホーム画像
│   ├── pictures/                   # アルバム写真
│   ├── post_pictures/              # 投稿画像
│   ├── chat_pictures/              # チャット画像
│   └── receipt_images/             # レシート画像
│
├── pyproject.toml                  # Poetry依存関係・ツール設定
├── .env                            # 環境変数（git管理外）
├── .env.example                    # 環境変数テンプレート（git管理対象）
└── firebase_service_account.json   # Firebase認証キー（git管理外）
```

---

## フロントエンド（frontend/）

```
frontend/
├── src/
│   ├── main.tsx                    # エントリーポイント
│   ├── App.tsx                     # ルーティング定義・Providerラップ
│   │
│   ├── features/                   # 機能ドメインごとのフォルダ（バックエンドと対応）
│   │   ├── auth/
│   │   │   ├── components/         # ログイン・登録フォーム等
│   │   │   ├── hooks/              # useLogin, useLogout 等
│   │   │   ├── pages/              # LoginPage, SignupPage
│   │   │   └── types.ts            # この機能固有の型定義
│   │   ├── home/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── pages/
│   │   │   └── types.ts
│   │   ├── announces/
│   │   ├── albums/
│   │   ├── todos/
│   │   ├── reminders/
│   │   ├── posts/
│   │   ├── chat/
│   │   ├── schedule/
│   │   ├── costs/
│   │   └── activity/
│   │
│   ├── components/                 # 全機能で共通利用するUIコンポーネント
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx       # Header + Footer + Outlet
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   ├── ui/                     # ボタン・インプット・モーダル等の基本UI
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── ...
│   │   └── guards/
│   │       ├── AuthGuard.tsx       # ユーザーログイン必須
│   │       └── HomeGuard.tsx       # ホーム選択必須
│   │
│   ├── store/                      # Zustand グローバルストア
│   │   ├── authStore.ts            # 認証状態（user, home, homeUsers）
│   │   └── uiStore.ts              # UI状態（テーマ等）
│   │
│   ├── lib/
│   │   ├── apiClient.ts            # axios インスタンス設定（baseURL・認証・リトライ）
│   │   └── queryClient.ts          # TanStack Query クライアント設定
│   │
│   ├── hooks/                      # 全機能共通のカスタムフック
│   │   └── useToast.ts
│   │
│   ├── types/                      # グローバル共通型定義
│   │   ├── api.ts                  # APIレスポンスの共通型
│   │   └── common.ts
│   │
│   ├── utils/
│   │   ├── date.ts                 # 日付フォーマット
│   │   └── firebase.ts             # FCM初期化・トークン取得
│   │
│   └── styles/
│       ├── globals.css             # グローバルCSS（Tailwind base）
│       └── variables.css           # CSS変数（テーマカラー等）
│
├── public/
│   └── firebase-messaging-sw.js    # FCM Service Worker
│
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── package.json
├── .env.local                      # 環境変数（git管理外）
└── .env.example                    # 環境変数テンプレート
```

---

## Docker関連（docker/）

```
docker/
├── backend/
│   └── Dockerfile
├── frontend/
│   └── Dockerfile
└── nginx/
    ├── nginx.conf                  # 本番用リバースプロキシ設定
    └── nginx.dev.conf              # 開発用設定
```

---

> **命名規則の詳細は [09_coding_conventions.md](09_coding_conventions.md) を参照してください。**

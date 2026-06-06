# 環境変数定義

## バックエンド（backend/.env）

```bash
# ========================
# アプリケーション基本設定
# ========================
APP_NAME=Tomo-sumi
DEBUG=false
# true: Swagger UI有効・SQLログ出力（開発時のみ）

# ========================
# データベース
# ========================
# 形式: postgresql+asyncpg://ユーザー名:パスワード@ホスト:ポート/DB名
DATABASE_URL=postgresql+asyncpg://tomo:tomo@db:5432/tomo_dev

# ========================
# Redis
# ========================
# Celeryブローカー・バックエンドに使用
REDIS_URL=redis://redis:6379/0

# ========================
# JWT認証
# ========================
# 最低32文字のランダム文字列（本番は必ず変更する）
SECRET_KEY=change-this-to-a-random-string-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
ALGORITHM=HS256

# ========================
# CORS
# ========================
# カンマ区切りで複数指定可能
CORS_ORIGINS=http://localhost:5173,https://yourdomain.com

# ========================
# Firebase（FCMプッシュ通知）
# ========================
# サービスアカウントキーJSONファイルのパス
FIREBASE_SERVICE_ACCOUNT_PATH=firebase_service_account.json

# ========================
# メディアファイル
# ========================
MEDIA_ROOT=media
# 本番環境ではドメインに合わせて変更
MEDIA_BASE_URL=http://localhost:8000/media

# ========================
# Celery（タスクキュー）
# ========================
# REDIS_URLと同じで問題なし
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
```

### 開発環境のデフォルト値

```bash
# docker-compose.dev.yml で上書き済みのため .env に書かなくてよい
DATABASE_URL=postgresql+asyncpg://tomo:tomo@db:5432/tomo_dev
REDIS_URL=redis://redis:6379/0
DEBUG=true
SECRET_KEY=dev-secret-key-not-for-production
CORS_ORIGINS=http://localhost:5173
```

---

## フロントエンド（frontend/.env.local）

```bash
# ========================
# API接続先
# ========================
# バックエンドAPIのベースURL（末尾スラッシュなし）
VITE_API_BASE_URL=http://localhost:8000

# WebSocket接続先
VITE_WS_BASE_URL=ws://localhost:8000

# ========================
# アプリ設定
# ========================
VITE_APP_NAME=Tomo-sumi

# ========================
# Firebase（FCMプッシュ通知）
# ========================
# Firebaseコンソール > プロジェクト設定 > マイアプリ から取得
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
# VAPID Key: Firebaseコンソール > Cloud Messaging > ウェブプッシュ証明書
VITE_FIREBASE_VAPID_KEY=your-vapid-key
```

---

## Docker環境変数（docker-compose.yml用 / ルートの.env）

```bash
# ========================
# PostgreSQL
# ========================
POSTGRES_DB=tomo_prod
POSTGRES_USER=tomo
POSTGRES_PASSWORD=change-this-password

# ========================
# アプリ全体
# ========================
# バックエンドのACCESS_TOKEN_EXPIRE_MINUTESと合わせる
API_BASE_URL=https://yourdomain.com
APP_NAME=Tomo-sumi
```

---

## 環境別設定早見表

| 変数名 | 開発 | 本番 |
|--------|------|------|
| `DEBUG` | `true` | `false` |
| `DATABASE_URL` | `...@db:5432/tomo_dev` | `...@db:5432/tomo_prod` |
| `SECRET_KEY` | 固定値OK | 必ずランダム変更 |
| `CORS_ORIGINS` | `http://localhost:5173` | `https://yourdomain.com` |
| `MEDIA_BASE_URL` | `http://localhost:8000/media` | `https://yourdomain.com/media` |
| `VITE_API_BASE_URL` | `http://localhost:8000` | `https://yourdomain.com` |
| `VITE_WS_BASE_URL` | `ws://localhost:8000` | `wss://yourdomain.com` |

---

## .gitignore に必ず含めるファイル

```gitignore
# 環境変数
backend/.env
frontend/.env.local
frontend/.env.production.local

# Firebase認証キー（絶対にコミットしない）
backend/firebase_service_account.json

# メディアファイル
backend/media/

# Python
__pycache__/
*.pyc
.venv/

# Node
node_modules/
dist/
```

---

## SECRET_KEYの生成方法

```bash
# Pythonで生成
python -c "import secrets; print(secrets.token_hex(32))"

# または openssl で生成
openssl rand -hex 32
```

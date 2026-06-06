# 移行手順

## 移行の基本方針

- **既存DBは変更しない**（Alembicで既存スキーマを反映するだけ）
- **フロントエンドは新規再構築**（CRA→Vite、SCSS→Tailwind、Context→Zustand）
- **バックエンドは新規構築**（Django→FastAPI）
- **APIのURLは変更**（既存フロントを捨てるため互換性不要）
- **本番切り替えはDNS/Nginxの向き替えで一括**

---

## フェーズ概要

| フェーズ | 内容 | 目安期間 |
|---------|------|---------|
| 0 | 環境構築・設計確認 | 1週間 |
| 1 | バックエンド基盤（DB・認証） | 1〜2週間 |
| 2 | バックエンド機能実装 | 3〜4週間 |
| 3 | フロントエンド基盤 | 1週間 |
| 4 | フロントエンド機能実装 | 3〜4週間 |
| 5 | 結合テスト・修正 | 1〜2週間 |
| 6 | 本番移行 | 1週間 |
| **合計** | | **10〜15週間** |

---

## フェーズ0：環境構築・設計確認（1週間）

### チェックリスト

- [ ] リポジトリ初期化（tomo-sumi/）
- [ ] `docs/` の全ドキュメントを読み込んで設計確認
- [ ] Docker開発環境の起動確認
  ```bash
  docker compose -f docker-compose.dev.yml up -d
  ```
- [ ] Poetry環境の初期化
  ```bash
  cd backend
  poetry install
  ```
- [ ] npm環境の初期化
  ```bash
  cd frontend
  npm install
  ```
- [ ] `.env` / `.env.local` をテンプレートから作成
- [ ] Alembic初期化
  ```bash
  docker compose -f docker-compose.dev.yml exec backend alembic init alembic
  ```

---

## フェーズ1：バックエンド基盤（1〜2週間）

### 1-1. プロジェクト構造の作成

```bash
# ディレクトリ作成
mkdir -p backend/app/{core,models,features,tasks,utils}
mkdir -p backend/app/features/{auth,homes,announces,albums,todos,reminders,posts,chat,schedule,costs,activity}
mkdir -p backend/tests/features
mkdir -p backend/media/{icons,home_images,pictures,post_pictures,chat_pictures,receipt_images}
```

### 1-2. 実装順序

1. `app/core/config.py` - 設定クラス
2. `app/core/database.py` - DB接続
3. `app/core/security.py` - JWT・パスワードハッシュ
4. `app/models/base.py` - BaseクラスとTimestampMixin
5. 全モデル定義（`app/models/*.py`）
6. Alembicマイグレーション作成・適用
7. `app/core/dependencies.py` - 認証依存関係
8. `app/features/auth/` - 認証エンドポイント
9. `app/main.py` - アプリ起動・ルーター登録

### 1-3. DB初回マイグレーション

```bash
# マイグレーションファイル作成
docker compose -f docker-compose.dev.yml exec backend \
  alembic revision --autogenerate -m "initial_tables"

# 適用
docker compose -f docker-compose.dev.yml exec backend \
  alembic upgrade head

# 確認
docker compose -f docker-compose.dev.yml exec backend \
  alembic current
```

### 1-4. 認証動作確認

```bash
# Swagger UIで動作確認
open http://localhost:8000/docs

# curlでテスト
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "TestPass123!", "nickname": "テスト"}'
```

---

## フェーズ2：バックエンド機能実装（3〜4週間）

### 実装優先度

#### 優先度1（基盤・コア）

| 機能 | ファイル | 目安 |
|------|--------|------|
| ホーム管理 | `features/homes/` | 3日 |
| アクティビティログ | `features/activity/` | 2日 |

#### 優先度2（主要機能）

| 機能 | ファイル | 目安 |
|------|--------|------|
| お知らせ | `features/announces/` | 2日 |
| スケジュール | `features/schedule/` | 2日 |
| TODOリスト | `features/todos/` | 2日 |
| リマインダー | `features/reminders/` | 3日 |

#### 優先度3（拡張機能）

| 機能 | ファイル | 目安 |
|------|--------|------|
| 投稿・SNS | `features/posts/` | 3日 |
| アルバム | `features/albums/` | 2日 |
| チャット（REST+WS） | `features/chat/` | 3日 |
| 家計管理 | `features/costs/` | 5日 |

### 機能実装パターン

各機能は以下の順で実装する：

```
1. schemas.py  → Pydanticスキーマ（Request/Response）
2. service.py  → ビジネスロジック（SQLAlchemyクエリ）
3. router.py   → FastAPIエンドポイント定義
4. main.pyに router を登録
5. tests/features/test_XXX.py → pytestテスト
```

### Celeryタスク実装

```bash
# リマインダー実装後にタスク実装
# app/tasks/reminder_tasks.py
# app/tasks/cost_tasks.py

# Celery Workerの動作確認
docker compose -f docker-compose.dev.yml logs worker
```

---

## フェーズ3：フロントエンド基盤（1週間）

### 3-1. プロジェクト構造の作成

```bash
cd frontend

# 機能フォルダ作成
mkdir -p src/features/{auth,home,announces,albums,todos,reminders,posts,chat,schedule,costs,activity}

# 各機能フォルダに components/ hooks/ pages/ types.ts を作成
for feature in auth home announces albums todos reminders posts chat schedule costs activity; do
  mkdir -p src/features/$feature/{components,hooks,pages}
  touch src/features/$feature/types.ts
done

# 共通フォルダ
mkdir -p src/components/{layout,ui,guards}
mkdir -p src/store src/lib src/hooks src/types src/utils src/styles
```

### 3-2. 実装順序

1. `src/lib/apiClient.ts` - axiosインスタンス（リトライ・Cookie設定）
2. `src/lib/queryClient.ts` - TanStack Query設定
3. `src/store/authStore.ts` - Zustand認証ストア
4. `src/components/guards/` - AuthGuard / HomeGuard
5. `src/components/layout/` - AppLayout / Header / Footer
6. `src/App.tsx` - ルーティング定義
7. `src/features/auth/` - ログイン・登録ページ

### 3-3. Tailwind + shadcn/ui セットアップ

```bash
npx tailwindcss init -p
npx shadcn@latest init
# プロジェクト設定に従って選択
```

---

## フェーズ4：フロントエンド機能実装（3〜4週間）

### 実装優先度（バックエンドと対応）

#### 優先度1

| 機能 | 画面 | 目安 |
|------|------|------|
| ホーム選択・作成 | HomeSwitcherPage, HomeCreatePage | 2日 |
| ダッシュボード | DashboardPage | 3日 |
| ホーム・ユーザー設定 | SettingsPages | 2日 |

#### 優先度2

| 機能 | 画面 | 目安 |
|------|------|------|
| お知らせ | 一覧・詳細・編集 | 2日 |
| スケジュール | カレンダー・詳細・編集 | 3日 |
| TODOリスト | 一覧・編集 | 2日 |
| リマインダー | 一覧・グループ編集・内容編集 | 3日 |

#### 優先度3

| 機能 | 画面 | 目安 |
|------|------|------|
| 投稿（SNS） | 一覧・詳細・編集 | 3日 |
| アルバム | 一覧・詳細・編集 | 2日 |
| チャット | チャット画面（WebSocket） | 3日 |
| 家計管理 | 一覧・詳細・編集・サマリー・清算 | 5日 |
| アクティビティ | アクティビティ画面 | 1日 |

### 機能実装パターン

```
1. types.ts        → TypeScriptインターフェース
2. hooks/          → TanStack Query フック（useXxx, useCreateXxx等）
3. components/     → UIコンポーネント
4. pages/          → ページコンポーネント（フックとコンポーネントの組み合わせ）
5. App.tsx         → ルートを追加
```

---

## フェーズ5：結合テスト・修正（1〜2週間）

### チェックリスト

- [ ] 全APIエンドポイントのpytestテスト
- [ ] フロントエンドの全画面動作確認
- [ ] WebSocket（チャット）の動作確認
- [ ] FCMプッシュ通知の動作確認
- [ ] 月末自動清算Celeryタスクの動作確認
- [ ] リマインダー通知Celeryタスクの動作確認
- [ ] ファイルアップロード（アルバム・レシート）の動作確認
- [ ] 招待コードによるホーム参加フローの確認
- [ ] トークンリフレッシュ・ログアウトの確認
- [ ] モバイルブラウザでの表示確認

### テスト実行

```bash
# バックエンドテスト
docker compose -f docker-compose.dev.yml exec backend \
  pytest tests/ -v --tb=short

# フロントエンドTypeチェック
cd frontend && npm run typecheck
```

---

## フェーズ6：本番移行（1週間）

### 6-1. 本番環境準備

```bash
# .env（本番用）を設定
cp backend/.env.example backend/.env
# SECRET_KEY, DATABASE_URL, REDIS_URL 等を本番値に設定

# Firebase サービスアカウントキーを配置
cp /path/to/firebase_service_account.json backend/firebase_service_account.json
```

### 6-2. 本番用ビルド・起動

```bash
# 本番用イメージビルド
docker compose build

# 起動
docker compose up -d

# DBマイグレーション（既存DBを使う場合はスキップ）
docker compose exec backend alembic upgrade head
```

### 6-3. 切り替え手順

```
1. DNS / Nginxの向き先を新システムに変更
2. 動作確認（ログイン・主要機能）
3. 旧システム（Django）をSTOP（削除はしない）
4. 1週間は旧システムを保持（問題があれば切り戻し可能）
5. 問題なければ旧システムを削除
```

---

## 移行上の重要注意点

### 1. 既存ユーザーのパスワード

既存ユーザーのパスワードはDjango（PBKDF2）でハッシュされている。  
FastAPIはbcryptを使用するため、**既存パスワードハッシュはそのまま使えない**。

**対応策：**
- 初回ログイン時に「パスワードの再設定」を要求する
- または、メール認証リンクで再設定を促す

### 2. 既存画像ファイル

`media/` ディレクトリをそのまま引き継ぐ。  
ただし、旧システムのURLパス（例: `homeImages/`）と新システムの保存パス（`home_images/`）が異なる場合はパス変換が必要。

### 3. DBカラム名の変更

旧システムの一部カラム名（`homeImage`, `complete_flg`等）をスネークケースに変更する場合、Alembicのマイグレーションで`alter column`が必要。

**推奨：** 新DBに新テーブルを作成し、旧DBからデータを移行する（`INSERT INTO new_table SELECT ... FROM old_table`）。

### 4. 清算ロジック

`cost_tasks.py` の月末清算ロジックは最も複雑。  
必ず単体テストを先に整備してから実装する。

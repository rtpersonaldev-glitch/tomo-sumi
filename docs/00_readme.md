# Tomo-sumi 設計ドキュメント

> **Claude Codeへ：** このファイルを最初に読んでください。  
> ドキュメントの全体像と、タスク別の読み方を説明します。

---

## プロジェクト概要

**Tomo-sumi** は家族・同居人向けのホーム共有管理アプリです。

| 項目 | 内容 |
|------|------|
| フロントエンド | React 18 + TypeScript + Vite + TanStack Query + Zustand + Tailwind CSS |
| バックエンド | FastAPI + SQLAlchemy 2.0 (async) + Alembic + Celery |
| DB | PostgreSQL 16 |
| キャッシュ/タスクブローカー | Redis 7 |
| プッシュ通知 | Firebase FCM |
| インフラ | Docker Compose + Nginx |

---

## ドキュメント一覧

| ファイル | 内容 | 読むタイミング |
|---------|------|--------------|
| **[01_directory_structure.md](01_directory_structure.md)** | フォルダ構成・ファイル命名ルール | 新機能追加前に必ず確認 |
| **[02_docker_config.md](02_docker_config.md)** | docker-compose・Dockerfile・nginx設定 | 環境構築時 |
| **[03_db_config.md](03_db_config.md)** | 全32テーブルのSQLAlchemyモデル定義 | DBアクセスを伴う実装時 |
| **[04_fastapi_config.md](04_fastapi_config.md)** | FastAPI設定・router/serviceパターン・Celery | バックエンド実装時 |
| **[05_react_config.md](05_react_config.md)** | Vite設定・TanStack Queryフックパターン・Zustand | フロントエンド実装時 |
| **[06_auth_config.md](06_auth_config.md)** | JWT設計・Cookie設定・2段階認証フロー | 認証関連の実装時 |
| **[07_api_list.md](07_api_list.md)** | 全85エンドポイント一覧（認証レベル付き） | API設計確認・フロント連携時 |
| **[08_migration_steps.md](08_migration_steps.md)** | Django→FastAPI移行の6フェーズ手順 | 進捗確認・フェーズ開始時 |
| **[09_coding_conventions.md](09_coding_conventions.md)** | Python/TypeScript規約・命名規則・Gitコミット規約 | コード記述前に必ず確認 |
| **[10_environment_variables.md](10_environment_variables.md)** | backend/.env・frontend/.env.local の全変数定義 | 環境変数追加・確認時 |
| **[11_error_handling.md](11_error_handling.md)** | HTTPステータス規約・グローバルエラーハンドラー・フロントエラーパターン | エラー処理実装時 |
| **[12_testing_strategy.md](12_testing_strategy.md)** | pytest設定・conftest・テストパターン | テスト実装時 |
| **[13_file_upload.md](13_file_upload.md)** | ファイルアップロードのBE/FE実装パターン | 画像・ファイル送信を含む機能実装時 |
| **[14_websocket_auth.md](14_websocket_auth.md)** | WebSocket認証方法・チャットプロトコル詳細 | チャット機能実装時 |
| **[15_git_workflow.md](15_git_workflow.md)** | ブランチ戦略・Issue/PR運用・Claude Code開発フロー | Issue着手前・PR作成時 |
| **[16_ui_design.md](16_ui_design.md)** | UIデザインガイドライン・カラー・レイアウト・ワイヤーフレームフロー | フロントエンドUI実装前に必ず確認 |

---

## 機能一覧と担当ファイル

| 機能 | バックエンド | フロントエンド | 関連docs |
|------|------------|--------------|---------|
| 認証（ログイン・ホーム選択） | `features/auth/` | `features/auth/` | 06, 07 |
| ホーム管理（作成・招待） | `features/homes/` | `features/home/` | 07 |
| お知らせ | `features/announces/` | `features/announces/` | 07 |
| アルバム（写真） | `features/albums/` | `features/albums/` | 07, **13** |
| TODOリスト | `features/todos/` | `features/todos/` | 07 |
| リマインダー | `features/reminders/` | `features/reminders/` | 07 |
| 投稿（SNS） | `features/posts/` | `features/posts/` | 07, **13** |
| チャット（WebSocket） | `features/chat/` | `features/chat/` | 07, **14** |
| スケジュール | `features/schedule/` | `features/schedule/` | 07 |
| 家計管理・清算 | `features/costs/` | `features/costs/` | 07, **13** |
| アクティビティログ | `features/activity/` | `features/activity/` | 07 |

---

## タスク別ドキュメントの読み方

### 新しい機能（例：announces）を実装するとき

```
1. 09_coding_conventions.md  → コーディング規約を確認
2. 07_api_list.md           → 担当APIのエンドポイントと認証レベルを確認
3. 03_db_config.md          → 使用するテーブルのモデル定義を確認
4. 04_fastapi_config.md     → router/serviceパターンをコピーして実装
5. 05_react_config.md       → TanStack Queryフックパターンをコピーして実装
```

### 画像・ファイルアップロードを含む機能を実装するとき

```
上記に加えて:
6. 13_file_upload.md        → FastAPIのFile受け取り方・Reactの送り方を確認
```

### チャット機能を実装するとき

```
上記に加えて:
6. 14_websocket_auth.md     → WebSocket認証・メッセージプロトコルを確認
```

### 認証・ガードを修正するとき

```
1. 06_auth_config.md        → JWT設計・依存関係・フロントのガード実装を確認
```

### 環境変数を追加・確認するとき

```
1. 10_environment_variables.md → 全変数の一覧と用途を確認（唯一の定義場所）
```

---

## 機能間の依存関係

```
auth（認証） ←─ 全機能が依存
homes（ホーム） ←─ auth後、全機能が依存
activity（ログ） ←─ 全機能からログを記録
costs/tasks ←─ homes・users
reminders/tasks ←─ reminders・FCM（fcm.py）
```

**注意：** `activity_logger.py` は全機能のサービス層から呼ばれる。機能実装時はアクティビティログの記録も忘れずに追加する。

---

## 開発開始手順（ゼロから始める場合）

```bash
# 1. 環境変数ファイルを作成
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 2. Dockerコンテナ起動
docker compose -f docker-compose.dev.yml up -d

# 3. DBマイグレーション
docker compose -f docker-compose.dev.yml exec backend alembic upgrade head

# 4. 動作確認
# Swagger UI: http://localhost:8000/docs
# フロントエンド: http://localhost:5173
```

---

## 実装パターンのクイックリファレンス

### バックエンド：1機能を追加する最小構成

```
backend/app/features/{feature}/
├── schemas.py   ← Pydantic Request/Response スキーマを定義
├── service.py   ← SQLAlchemyを使ったビジネスロジック
└── router.py    ← FastAPIエンドポイント（serviceを呼ぶだけ）
```

→ 実装後、`app/main.py` にルーターを1行追加する。

### フロントエンド：1機能を追加する最小構成

```
frontend/src/features/{feature}/
├── types.ts        ← APIレスポンスのTypeScriptインターフェース
├── hooks/          ← TanStack Query フック（useXxx, useCreateXxx）
├── components/     ← UIコンポーネント
└── pages/          ← ページコンポーネント（フック + コンポーネント）
```

→ 実装後、`src/App.tsx` にルートを1行追加する。

---

## 既存システムからの主な変更点

| 変更点 | 旧（Django） | 新（FastAPI） |
|--------|------------|-------------|
| ビルドツール | CRA + Craco | Vite |
| 状態管理 | Context API | Zustand |
| データフェッチ | カスタムfetchフック | TanStack Query |
| スタイリング | SCSS | Tailwind CSS + shadcn/ui |
| 認証 | セッション+JWT | JWT（HTTPonly Cookie） |
| ホームID管理 | DB保存 | JWTペイロードに埋め込み |
| パスワードハッシュ | Django PBKDF2 | bcrypt（移行時要注意 → [08](08_migration_steps.md#移行上の重要注意点)） |

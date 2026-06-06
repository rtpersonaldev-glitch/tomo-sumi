# API一覧（新システム）

## 共通仕様

| 項目 | 内容 |
|------|------|
| ベースURL | `VITE_API_BASE_URL`（例: `https://yourdomain.com`） |
| 認証 | JWT（HTTPonly クッキー `access_token`） |
| リクエスト形式 | `withCredentials: true`（Cookieを自動送信） |
| レスポンス形式 | JSON |
| エラー形式 | `{"detail": "エラーメッセージ"}` |
| API自動仕様書 | `GET /docs`（Swagger UI・開発環境のみ） |
| API仕様書（別形式） | `GET /redoc`（ReDoc・開発環境のみ） |

### 認証レベル凡例

| レベル | 説明 |
|--------|------|
| 🔓 公開 | 認証不要 |
| 🔑 要認証 | ユーザーログイン必須 |
| 🏠 要ホーム | ユーザーログイン + ホーム選択必須（JWTに`home_id`が必要） |

---

## 認証（/api/auth/）

| メソッド | エンドポイント | レベル | 説明 |
|---------|-------------|--------|------|
| POST | `/api/auth/register` | 🔓 | ユーザー登録 |
| POST | `/api/auth/login` | 🔓 | ログイン（Cookieにトークンをセット） |
| GET | `/api/auth/me` | 🔑 | 自分のユーザー情報・所属ホーム一覧取得 |
| POST | `/api/auth/refresh` | 🔑 | アクセストークン更新 |
| POST | `/api/auth/logout` | 🔑 | ログアウト（Cookie削除） |
| POST | `/api/auth/home-login/{home_id}` | 🔑 | ホーム選択（JWTにhome_idを付与） |
| POST | `/api/auth/home-logout` | 🔑 | ホームからログアウト |
| PUT | `/api/auth/profile` | 🔑 | プロフィール更新（アイコン・ニックネーム） |
| POST | `/api/auth/status/toggle` | 🔑 | 在宅ステータス切り替え |
| GET | `/api/auth/settings` | 🔑 | アプリ設定・通知フラグ取得 |
| POST | `/api/auth/notification/toggle` | 🔑 | 通知フラグ切り替え |
| POST | `/api/auth/fcm-token` | 🔑 | FCMトークン登録 |

---

## ホーム管理（/api/homes/）

| メソッド | エンドポイント | レベル | 説明 |
|---------|-------------|--------|------|
| GET | `/api/homes` | 🔑 | 所属ホーム一覧 |
| POST | `/api/homes` | 🔑 | 新規ホーム作成 |
| GET | `/api/homes/{home_id}` | 🔑 | ホーム詳細 |
| PUT | `/api/homes/{home_id}` | 🏠 | ホーム情報更新 |
| GET | `/api/homes/{home_id}/users` | 🏠 | ホームメンバー一覧 |
| GET | `/api/homes/{home_id}/invitation-code` | 🏠 | 招待コード生成・取得 |
| POST | `/api/homes/join/{code}` | 🔑 | 招待コードでホームに参加 |
| GET | `/api/homes/dashboard` | 🏠 | ダッシュボード情報（メンバー状態・スケジュール・お知らせ等） |

---

## お知らせ（/api/announces/）

| メソッド | エンドポイント | レベル | 説明 |
|---------|-------------|--------|------|
| GET | `/api/announces/{home_id}` | 🏠 | お知らせ一覧（`?search=&priority=&ordering=`） |
| POST | `/api/announces` | 🏠 | お知らせ作成 |
| GET | `/api/announces/{id}/detail` | 🏠 | お知らせ詳細 |
| PUT | `/api/announces/{id}` | 🏠 | お知らせ更新 |
| DELETE | `/api/announces/{id}` | 🏠 | お知らせ削除 |
| POST | `/api/announces/{id}/like` | 🏠 | いいね切り替え |
| POST | `/api/announces/{id}/push` | 🏠 | プッシュ通知送信 |

---

## アルバム（/api/albums/）

| メソッド | エンドポイント | レベル | 説明 |
|---------|-------------|--------|------|
| GET | `/api/albums/{home_id}` | 🏠 | アルバム一覧 |
| POST | `/api/albums` | 🏠 | アルバム作成（multipart/form-data） |
| GET | `/api/albums/{id}` | 🏠 | アルバム詳細（写真一覧含む） |
| PUT | `/api/albums/{id}` | 🏠 | アルバム更新・写真追加 |
| DELETE | `/api/albums/{id}` | 🏠 | アルバム削除 |
| DELETE | `/api/albums/{id}/pictures/{pic_id}` | 🏠 | 特定写真の削除 |

---

## TODOリスト（/api/todos/）

| メソッド | エンドポイント | レベル | 説明 |
|---------|-------------|--------|------|
| GET | `/api/todos/{home_id}` | 🏠 | TODOリスト一覧（`?search=&ordering=`） |
| POST | `/api/todos` | 🏠 | TODOリスト作成 |
| GET | `/api/todos/{id}` | 🏠 | TODOリスト詳細 |
| PUT | `/api/todos/{id}` | 🏠 | TODOリスト更新（内容含む） |
| DELETE | `/api/todos/{id}` | 🏠 | TODOリスト削除 |

---

## リマインダー（/api/reminders/）

| メソッド | エンドポイント | レベル | 説明 |
|---------|-------------|--------|------|
| GET | `/api/reminders/{home_id}` | 🏠 | リマインダーグループ一覧 |
| POST | `/api/reminders` | 🏠 | リマインダーグループ作成 |
| GET | `/api/reminders/{id}` | 🏠 | リマインダーグループ詳細 |
| PUT | `/api/reminders/{id}` | 🏠 | リマインダーグループ更新 |
| DELETE | `/api/reminders/{id}` | 🏠 | リマインダーグループ削除 |
| GET | `/api/reminders/{id}/contents` | 🏠 | リマインダー内容一覧 |
| POST | `/api/reminders/{id}/contents` | 🏠 | リマインダー内容作成 |
| GET | `/api/reminders/contents/{content_id}` | 🏠 | リマインダー内容詳細 |
| PUT | `/api/reminders/contents/{content_id}` | 🏠 | リマインダー内容更新 |
| POST | `/api/reminders/contents/{content_id}/toggle` | 🏠 | 完了フラグ切り替え |

---

## 投稿・SNS（/api/posts/）

| メソッド | エンドポイント | レベル | 説明 |
|---------|-------------|--------|------|
| GET | `/api/posts/{home_id}` | 🏠 | 投稿一覧 |
| POST | `/api/posts` | 🏠 | 投稿作成（multipart/form-data） |
| GET | `/api/posts/{id}` | 🏠 | 投稿詳細（コメント・いいね含む） |
| PUT | `/api/posts/{id}` | 🏠 | 投稿更新 |
| DELETE | `/api/posts/{id}` | 🏠 | 投稿削除 |
| POST | `/api/posts/{id}/like` | 🏠 | いいね切り替え |
| POST | `/api/posts/{id}/comments` | 🏠 | コメント追加 |
| DELETE | `/api/posts/{id}/comments/{comment_id}` | 🏠 | コメント削除 |

---

## チャット（/api/chat/）

| メソッド | エンドポイント | レベル | 説明 |
|---------|-------------|--------|------|
| GET | `/api/chat/{home_id}/messages` | 🏠 | チャット履歴取得（ページネーション対応） |
| WS | `/api/chat/ws/{home_id}` | 🏠 | WebSocketリアルタイム接続 |

**WebSocketメッセージ形式（送信）:**
```json
{ "type": "message", "message": "テキスト" }
```

**WebSocketメッセージ形式（受信）:**
```json
{
  "id": 123,
  "type": "message",
  "message": "テキスト",
  "user_id": 42,
  "nickname": "ユーザー名",
  "icon_url": "https://...",
  "timestamp": "2026-06-06T12:00:00+09:00"
}
```

---

## スケジュール（/api/schedules/）

| メソッド | エンドポイント | レベル | 説明 |
|---------|-------------|--------|------|
| GET | `/api/schedules/{home_id}` | 🏠 | スケジュール一覧（`?start=&end=`） |
| POST | `/api/schedules` | 🏠 | スケジュール作成 |
| GET | `/api/schedules/{id}` | 🏠 | スケジュール詳細 |
| PUT | `/api/schedules/{id}` | 🏠 | スケジュール更新 |
| DELETE | `/api/schedules/{id}` | 🏠 | スケジュール削除 |

---

## 家計管理（/api/costs/）

| メソッド | エンドポイント | レベル | 説明 |
|---------|-------------|--------|------|
| GET | `/api/costs/{home_id}` | 🏠 | 未清算支出一覧（`?category=&user=&method=`） |
| POST | `/api/costs` | 🏠 | 支出作成（multipart/form-data・レシート画像対応） |
| GET | `/api/costs/{id}` | 🏠 | 支出詳細 |
| PUT | `/api/costs/{id}` | 🏠 | 支出更新 |
| DELETE | `/api/costs/{id}` | 🏠 | 支出削除 |
| GET | `/api/costs/{home_id}/categories` | 🏠 | カテゴリ一覧 |
| POST | `/api/costs/{home_id}/categories` | 🏠 | カテゴリ作成・更新 |
| GET | `/api/costs/{home_id}/summary` | 🏠 | 集計サマリー（`?user=&category=&period=`） |
| GET | `/api/costs/{home_id}/settings` | 🏠 | 自動清算・固定費設定取得 |
| PUT | `/api/costs/{home_id}/settings/auto-seisan` | 🏠 | 自動清算設定更新 |
| GET | `/api/costs/{home_id}/koteihi` | 🏠 | 固定費一覧 |
| POST | `/api/costs/{home_id}/koteihi` | 🏠 | 固定費作成 |
| PUT | `/api/costs/koteihi/{id}` | 🏠 | 固定費更新 |
| DELETE | `/api/costs/koteihi/{id}` | 🏠 | 固定費削除 |
| POST | `/api/costs/seisan` | 🏠 | 清算レコード作成 |
| GET | `/api/costs/{home_id}/seisan/pending` | 🏠 | 清算待ち一覧 |
| GET | `/api/costs/{home_id}/seisan/completed` | 🏠 | 清算済み一覧 |
| GET | `/api/costs/seisan/{id}` | 🏠 | 清算詳細 |
| POST | `/api/costs/seisan-meisai/{id}/complete` | 🏠 | 清算明細を完了にする |

---

## アクティビティ（/api/activity/）

| メソッド | エンドポイント | レベル | 説明 |
|---------|-------------|--------|------|
| GET | `/api/activity/{home_id}` | 🏠 | アクティビティログ一覧 |
| GET | `/api/activity/unread-count` | 🏠 | 未読件数 |
| POST | `/api/activity/mark-as-read` | 🏠 | 既読にする |

---

## エンドポイント数サマリー

| カテゴリ | REST | WS | 合計 |
|---------|------|-----|------|
| 認証 | 12 | - | 12 |
| ホーム管理 | 8 | - | 8 |
| お知らせ | 7 | - | 7 |
| アルバム | 6 | - | 6 |
| TODOリスト | 5 | - | 5 |
| リマインダー | 10 | - | 10 |
| 投稿・SNS | 8 | - | 8 |
| チャット | 1 | 1 | 2 |
| スケジュール | 5 | - | 5 |
| 家計管理 | 19 | - | 19 |
| アクティビティ | 3 | - | 3 |
| **合計** | **84** | **1** | **85** |

---

## 共通レスポンス形式

### 成功（リスト）

```json
[
  { "id": 1, "title": "タイトル", ... },
  { "id": 2, "title": "タイトル", ... }
]
```

### 成功（単体）

```json
{ "id": 1, "title": "タイトル", "created_at": "2026-06-06T12:00:00+09:00", ... }
```

### エラー

```json
{ "detail": "エラーメッセージ" }
```

### バリデーションエラー（422）

```json
{
  "detail": [
    {
      "type": "string_too_short",
      "loc": ["body", "title"],
      "msg": "String should have at least 1 character",
      "input": ""
    }
  ]
}
```

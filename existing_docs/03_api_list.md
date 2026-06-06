# API一覧

## 共通仕様

| 項目 | 内容 |
|------|------|
| ベースURL | 環境変数 `REACT_APP_API_HOST`（例: `https://dbgp.net`） |
| 認証 | JWT（HTTPonlyクッキー） |
| 認証ヘッダー | Cookieに含まれる `access_token` を自動送信 |
| 権限なしエンドポイント | `AllowAny`：register・login のみ |
| その他のエンドポイント | `IsAuthenticated` が必須 |
| リクエスト形式 | `credentials: 'include'`（クッキーを含める） |

---

## 認証・アカウント管理（/api/accounts/）

| エンドポイント | メソッド | 認証要否 | 説明 |
|--------------|---------|---------|------|
| `/api/accounts/register/` | POST | 不要 | 新規ユーザー登録 |
| `/api/accounts/login` | POST | 不要 | メール＋パスワードでログイン、JWTをクッキーにセット |
| `/api/accounts/auth/` | GET | 要 | 現在の認証状態取得（ユーザー・ホーム情報） |
| `/api/accounts/auth/refresh/` | POST | 要 | アクセストークン更新 |
| `/api/accounts/auth/logout/` | POST | 要 | ログアウト |
| `/api/accounts/auth/homeLogin/{id}/` | POST | 要 | 指定ホームへ切り替えログイン |
| `/api/accounts/auth/homeLogout/` | POST | 要 | ホームからログアウト |
| `/api/accounts/save/{id}/` | PUT | 不要 | ユーザープロフィール更新 |
| `/api/accounts/status/toggle/` | POST | 要 | 在宅ステータス切り替え（at_home/away） |
| `/api/accounts/app-settings/` | GET | 要 | アプリ設定・通知フラグ取得 |
| `/api/accounts/notification-flag/toggle/` | POST | 要 | 通知フラグのON/OFF切り替え |
| `/api/accounts/fcm-token/` | POST | 要 | FCMトークン登録 |

---

## ホーム・世帯管理（/api/user-home/）

| エンドポイント | メソッド | 認証要否 | 説明 |
|--------------|---------|---------|------|
| `/api/user-home/homes/` | GET | 要 | ログインユーザーが所属する全ホーム一覧 |
| `/api/user-home/{home_id}/users/` | GET | 要 | 指定ホームのメンバー一覧 |
| `/api/user-home/view` | GET | 要 | 現在ホームのダッシュボード情報 |
| `/api/user-home/save/` | POST | 要 | 新規ホーム作成 |
| `/api/user-home/save/{id}/` | PUT | 要 | ホーム情報更新 |
| `/api/user-home/get/invitationCode/{homeId}/` | GET | 要 | 招待コード生成・取得 |
| `/api/user-home/invite/{invitationCode}/` | POST | 要 | 招待コードでホームに参加 |

---

## お知らせ（/api/announces/）

| エンドポイント | メソッド | 認証要否 | 説明 |
|--------------|---------|---------|------|
| `/api/announces/{homeId}/` | GET | 要 | ホームのお知らせ一覧（クエリ: `search`, `priority`, `ordering`） |
| `/api/announces/get/{id}/` | GET | 要 | お知らせ詳細 |
| `/api/announces/update/` | POST | 要 | お知らせ新規作成 |
| `/api/announces/update/{id}/` | PUT | 要 | お知らせ更新 |
| `/api/announces/{id}/like/` | POST | 要 | いいねのON/OFF切り替え |
| `/api/announces/push/{id}/` | POST | 要 | プッシュ通知送信 |

---

## アルバム（/api/albums/）

| エンドポイント | メソッド | 認証要否 | 説明 |
|--------------|---------|---------|------|
| `/api/albums/{homeId}/` | GET | 要 | ホームのアルバム一覧 |
| `/api/albums/get/{id}/` | GET | 要 | アルバム詳細（写真一覧含む） |
| `/api/albums/save/` | POST | 要 | アルバム新規作成 |
| `/api/albums/save/{id}/` | PUT | 要 | アルバム更新・写真追加 |

---

## TODOリスト（/api/todo/）

| エンドポイント | メソッド | 認証要否 | 説明 |
|--------------|---------|---------|------|
| `/api/todo/{homeId}/` | GET | 要 | TODOリスト一覧（クエリ: `search`, `ordering`） |
| `/api/todo/get/{id}/` | GET | 要 | TODO詳細 |
| `/api/todo/update/` | POST | 要 | TODO新規作成 |
| `/api/todo/update/{id}/` | PUT | 要 | TODO更新 |

---

## リマインダー（/api/reminder/）

| エンドポイント | メソッド | 認証要否 | 説明 |
|--------------|---------|---------|------|
| `/api/reminder/{homeId}/` | GET | 要 | リマインダーグループ一覧 |
| `/api/reminder/get/{id}/` | GET | 要 | リマインダーグループ詳細 |
| `/api/reminder/save/` | POST | 要 | リマインダーグループ新規作成 |
| `/api/reminder/save/{id}/` | PUT | 要 | リマインダーグループ更新 |
| `/api/reminder/contents/{id}/` | GET | 要 | リマインダー内容一覧 |
| `/api/reminder/contents/get/{contentId}/` | GET | 要 | リマインダー内容詳細 |
| `/api/reminder/contents/save/{id}/` | POST | 要 | リマインダー内容作成・更新 |
| `/api/reminder/contents/check/toggle/{contentId}/` | POST | 要 | 完了フラグ切り替え |

---

## 投稿・SNS（/api/post/）

| エンドポイント | メソッド | 認証要否 | 説明 |
|--------------|---------|---------|------|
| `/api/post/{homeId}/` | GET | 要 | 投稿一覧 |
| `/api/post/get/{id}/` | GET | 要 | 投稿詳細（コメント・いいね含む） |
| `/api/post/save/` | POST | 要 | 投稿新規作成 |
| `/api/post/save/{id}/` | PUT | 要 | 投稿更新 |
| `/api/post/{id}/like/` | POST | 要 | いいねのON/OFF切り替え |

---

## チャット（/api/chat/）

| エンドポイント | メソッド | 認証要否 | 説明 |
|--------------|---------|---------|------|
| `/api/chat/message/get/{homeId}/` | GET | 要 | チャット履歴取得 |

**WebSocket:** `ws://127.0.0.1:8001/ws/chat/{homeId}/`  
リアルタイムメッセージの送受信に使用。

---

## カレンダー・スケジュール（/api/schedule/）

| エンドポイント | メソッド | 認証要否 | 説明 |
|--------------|---------|---------|------|
| `/api/schedule/{homeId}/` | GET | 要 | スケジュール一覧 |
| `/api/schedule/get/{scheduleId}/` | GET | 要 | スケジュール詳細 |
| `/api/schedule/save/` | POST | 要 | スケジュール新規作成 |
| `/api/schedule/save/{id}/` | PUT | 要 | スケジュール更新 |

---

## 家計管理（/api/cost/）

| エンドポイント | メソッド | 認証要否 | 説明 |
|--------------|---------|---------|------|
| `/api/cost/` | GET | 要 | 未清算支出一覧 |
| `/api/cost/get/{costId}/` | GET | 要 | 支出詳細 |
| `/api/cost/save/` | POST | 要 | 支出新規作成 |
| `/api/cost/save/{id}/` | PUT | 要 | 支出更新 |
| `/api/cost/category/` | GET | 要 | カテゴリ一覧 |
| `/api/cost/filter-menu/` | GET | 要 | フィルターメニュー取得 |
| `/api/cost/summary/` | GET | 要 | 集計サマリー（クエリ: `user`, `category`, `period`） |
| `/api/cost/summary-menu/` | GET | 要 | 集計フィルターメニュー |
| `/api/cost/settings/get/` | GET | 要 | 自動清算・固定費設定取得 |
| `/api/cost/settings/koteihi/{id}/get/` | GET | 要 | 固定費詳細 |
| `/api/cost/settings/autoSeisan/save/` | POST | 要 | 自動清算設定保存 |
| `/api/cost/settings/category/save/` | POST | 要 | カテゴリ保存 |
| `/api/cost/seisan/save/` | POST | 要 | 清算レコード作成 |
| `/api/cost/seisanmachi/{homeId}/` | GET | 要 | 清算待ち一覧 |
| `/api/cost/seisanmachi/get/{id}/` | GET | 要 | 清算待ち詳細 |
| `/api/cost/seisanzumi/{homeId}/` | GET | 要 | 清算済み一覧 |
| `/api/cost/seisanmeisai/{id}/complete/` | POST | 要 | 清算明細を完了にする |

---

## アクティビティ（/api/activity/）

| エンドポイント | メソッド | 認証要否 | 説明 |
|--------------|---------|---------|------|
| `/api/activity/{homeId}/` | GET | 要 | アクティビティログ一覧 |
| `/api/activity/unread_count/` | GET | 要 | 未読アクティビティ件数 |
| `/api/activity/mark_as_read/` | POST | 要 | アクティビティを既読にする |

---

## その他

| エンドポイント | メソッド | 認証要否 | 説明 |
|--------------|---------|---------|------|
| `/api/hellow/` | GET | 不要 | Hello World（動作確認用） |

---

## エンドポイント数サマリー

| カテゴリ | 件数 |
|---------|------|
| 認証・アカウント | 12 |
| ホーム管理 | 7 |
| お知らせ | 6 |
| アルバム | 4 |
| TODOリスト | 4 |
| リマインダー | 8 |
| 投稿・SNS | 5 |
| チャット | 1（+WS） |
| スケジュール | 4 |
| 家計管理 | 17 |
| アクティビティ | 3 |
| **合計** | **71+** |

# 外部サービス連携

## 連携サービス一覧

| サービス | 用途 | フロントエンド | バックエンド |
|---------|------|-------------|------------|
| Firebase Cloud Messaging（FCM） | プッシュ通知 | ○ | ○ |
| WebSocket（Django Channels） | リアルタイムチャット | ○ | ○ |
| Redis | Celeryブローカー・バックエンド | - | ○ |
| PostgreSQL | メインデータベース | - | ○ |

---

## 1. Firebase Cloud Messaging（FCM）

### 概要

家族メンバーへのプッシュ通知に使用。  
ブラウザ（Web Push）経由でリマインダーやお知らせの通知を送信する。

### フロントエンド側の実装

| 項目 | 内容 |
|------|------|
| パッケージ | `firebase` 11.4.0 |
| 設定ファイル | `src/utils/firevase.ts`（typo: firebase） |
| Firebaseプロジェクト | `lifesync-web` |
| Measurement ID | `G-YVGC6WPDVN` |
| VAPID Key | `BE6BCwemyrkQSuTbaMMRff8BUOjnsMnwnaEnnaofttVDWbTP_Q4zFXWyolSaJkcW7p1R0ECoooNcbmk5R2ud2wI` |
| Service Worker | `/firebase-messaging-sw.js`（バックグラウンド通知処理） |

**フロントエンドの処理フロー:**

1. ページ読み込み時にブラウザの通知権限をリクエスト
2. 権限が許可されたら FCM トークンを取得
3. FCM トークンをバックエンドに登録（`POST /api/accounts/fcm-token/`）
4. フォアグラウンド通知: Firebase SDK でリスン
5. バックグラウンド通知: Service Worker（`firebase-messaging-sw.js`）で処理

### バックエンド側の実装

| 項目 | 内容 |
|------|------|
| パッケージ | `firebase-admin` 6.7.0 |
| 設定ファイル | `config/serviceAccountKey.json`（サービスアカウントキー） |
| ユーティリティ | `utils/fcm.py` → `send_push_notification()` |
| トークン保存先 | `FCMToken` テーブル（ユーザーごとに複数デバイス対応） |
| 通知制御 | `CustomUser.notification_flag`（ユーザーごとにON/OFF可能） |

**使用箇所:**

| 機能 | 処理 |
|------|------|
| お知らせプッシュ | `POST /api/announces/push/{id}/` 実行時 |
| リマインダー通知 | `reminder.tasks.send_reminder` Celeryタスク実行時 |

---

## 2. WebSocket（リアルタイムチャット）

### 概要

家族メンバー間のリアルタイムメッセージングに使用。  
Django Channels（ASGI）がWebSocketサーバーを提供する。

### エンドポイント

| 環境 | WebSocket URL |
|------|-------------|
| 開発 | `ws://127.0.0.1:8001/ws/chat/{homeId}/` |

### フロントエンド側の実装

| 項目 | 内容 |
|------|------|
| API | ブラウザ標準 WebSocket API |
| 実装場所 | `src/pages/chat/ChatRoom.tsx` |
| インストール済みライブラリ | `socket.io-client` 4.8.1（未使用・WebSocket APIを直接使用） |

**メッセージフォーマット:**
```json
{
  "message": "メッセージ本文",
  "userid": 123
}
```

### バックエンド側の実装

| 項目 | 内容 |
|------|------|
| パッケージ | `channels` 4.2.0、`channels-redis` 4.2.1、`daphne` 4.1.2 |
| プロトコル | WebSocket（ASGI） |
| チャンネルレイヤー | インメモリ（開発時）/ Redis推奨（本番） |

---

## 3. Redis

### 概要

Celeryの非同期タスクキューのブローカー兼バックエンドとして使用。

| 項目 | 内容 |
|------|------|
| ホスト | localhost:6379 |
| ブローカー | `redis://localhost:6379/0` |
| バックエンド | `redis://localhost:6379/0` |
| パッケージ | `redis` 5.2.1、`channels-redis` 4.2.1 |

---

## 4. PostgreSQL

### 概要

メインのリレーショナルデータベース。

| 項目 | 内容 |
|------|------|
| エンジン | `django.db.backends.postgresql` |
| ドライバー | `psycopg2-binary` 2.9.10 |
| 接続設定 | 環境変数（DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT） |

---

## 環境変数まとめ（外部サービス関連）

### バックエンド

| 変数名 | 用途 |
|--------|------|
| `DB_NAME` | PostgreSQL データベース名 |
| `DB_USER` | PostgreSQL ユーザー名 |
| `DB_PASSWORD` | PostgreSQL パスワード |
| `DB_HOST` | PostgreSQL ホスト |
| `DB_PORT` | PostgreSQL ポート |
| `SECRET_KEY` | Django シークレットキー |
| `DEBUG` | デバッグモード |
| `ALLOWED_HOSTS` | 許可するホスト |

※ Firebase設定は `config/serviceAccountKey.json` ファイルで管理（環境変数ではなくファイル）

### フロントエンド

| 変数名 | 用途 |
|--------|------|
| `REACT_APP_API_HOST` | バックエンドAPIのベースURL |
| `REACT_APP_SYS_NAME` | アプリ名（ページタイトルに使用） |
| `HTTPS` | 開発サーバーHTTPS有効化 |
| `SSL_CRT_FILE` | 開発用SSL証明書パス |
| `SSL_KEY_FILE` | 開発用SSL秘密鍵パス |

※ Firebase設定（APIキー・プロジェクトID・VAPIDキー等）は `src/utils/firevase.ts` にハードコードされている  
→ **本番環境では環境変数化を推奨**

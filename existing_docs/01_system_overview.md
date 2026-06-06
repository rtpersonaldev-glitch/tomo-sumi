# システム概要

## アプリケーション名

**LifeSync-web**

## 概要

家族・世帯内のメンバーで情報を共有・管理するためのホーム管理アプリケーション。  
ユーザーは「ホーム（世帯）」に所属し、メンバー間での各種情報共有・タスク管理・家計管理を行う。

---

## アーキテクチャ

| 区分 | 技術 |
|------|------|
| フロントエンド | React 18 + TypeScript（SPA） |
| バックエンド | Django 5.1 + Django REST Framework |
| データベース | PostgreSQL |
| 非同期処理 | Celery + Redis |
| リアルタイム通信 | Django Channels（WebSocket） |
| プッシュ通知 | Firebase Cloud Messaging（FCM） |
| コンテナ | Docker（推定） |
| ビルドツール | Craco（フロントエンド） |
| ASGIサーバー | Daphne |

---

## システム構成図（概略）

```
[ブラウザ]
    │  HTTPS (port 3002)
    ▼
[React SPA]
    │  REST API / WebSocket
    ▼
[Django (Daphne/ASGI)]
    ├── REST API（DRF）
    ├── WebSocket（Django Channels）
    └── Celery Worker
         │
         ▼
    [Redis] ←── Celery Broker/Backend
         │
    [PostgreSQL]
```

---

## 主要機能一覧

| 機能 | 説明 |
|------|------|
| ユーザー認証 | メール＋パスワードによるログイン、JWT認証（HTTPonlyクッキー） |
| マルチホーム | 複数世帯への所属・切り替え、招待コードによる参加 |
| ダッシュボード | メンバー状態・スケジュール・お知らせ・リマインダーの一覧表示 |
| お知らせ | タイトル・本文・優先度・期限付きの通知管理 |
| アルバム | 写真のアップロード・アルバム管理 |
| 投稿（SNS） | リッチテキスト投稿・コメント・いいね機能 |
| チャット | リアルタイムメッセージング（WebSocket） |
| カレンダー | 家族共有のスケジュール管理 |
| TODOリスト | 共有タスク管理（チェックリスト形式） |
| リマインダー | 日時・繰り返し設定付きのリマインダー通知 |
| 家計管理 | 支出記録・カテゴリ管理・清算機能（自動清算対応） |
| アクティビティ | 操作ログ・未読通知管理 |
| ユーザー設定 | プロフィール編集・在宅ステータス切り替え |

---

## プロジェクト構成

### フロントエンド（LifeSync-web）

```
src/
├── pages/          # ルートごとのページコンポーネント（25+）
├── components/     # 再利用可能UIコンポーネント（42+）
├── contexts/       # React Context（認証）
├── hooks/          # カスタムフック（API通信・フォーム等）
├── utils/          # ユーティリティ（Firebase・日付・バリデーション等）
├── types/          # TypeScript型定義（13ファイル）
└── App.tsx         # ルーティング定義
```

### バックエンド（lifesync-web-backend）

```
backend/
├── settings/       # 環境別設定（base/dev/prod）
├── authentication.py   # カスタムJWT認証
└── asgi.py / wsgi.py

apps:
├── users/          # ユーザー管理・認証
├── homes/          # ホーム・世帯管理
├── announce/       # お知らせ
├── album/          # アルバム
├── todo/           # TODOリスト
├── reminder/       # リマインダー
├── post/           # 投稿・SNS機能
├── chat/           # チャット
├── cost/           # 家計管理・清算
├── schedule/       # カレンダー
└── activity/       # アクティビティログ
```

---

## 開発環境

| 項目 | 値 |
|------|----|
| フロントエンドポート | 3002（HTTPS） |
| バックエンドAPIホスト | 環境変数 `REACT_APP_API_HOST` で切り替え |
| DBホスト | 環境変数 `DB_HOST` で設定 |
| Redisホスト | localhost:6379 |
| タイムゾーン | Asia/Tokyo |
| 言語 | 日本語 |

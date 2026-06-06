# Django依存関係

## プロジェクト基本情報

| 項目 | 内容 |
|------|------|
| プロジェクト名 | lifesync-web-backend |
| フレームワーク | Django 5.1.3 |
| REST API | Django REST Framework 3.15.2 |
| Python | 3.x（推定） |
| データベース | PostgreSQL |
| タイムゾーン | Asia/Tokyo |
| 言語 | 日本語 |

---

## 依存関係一覧（requirements.txt）

### コアDjango・REST

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `Django` | 5.1.3 | Webフレームワーク本体 |
| `djangorestframework` | 3.15.2 | REST API構築フレームワーク |
| `djangorestframework-simplejwt` | 5.3.1 | JWT認証 |
| `django-cors-headers` | 4.6.0 | CORSヘッダー管理 |
| `django-sslserver` | 0.22 | 開発用SSLサーバー |
| `django-celery-beat` | 2.7.0 | Celeryスケジューラ（DBベース） |
| `django-timezone-field` | 7.1 | タイムゾーンフィールド |
| `django-webpack-loader` | 3.1.1 | Webpackバンドル連携 |

### 非同期・WebSocket

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `channels` | 4.2.0 | Django Channels（WebSocket対応） |
| `channels-redis` | 4.2.1 | ChannelsのRedisバックエンド |
| `daphne` | 4.1.2 | ASGIサーバー |
| `asgiref` | 3.8.1 | ASGI基盤ライブラリ |

### タスクキュー・非同期処理

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `celery` | 5.4.0 | 非同期タスクキュー |
| `django-celery-beat` | 2.7.0 | Celeryの定期タスクスケジューラ |
| `flower` | 2.0.1 | Celeryモニタリングツール |
| `redis` | 5.2.1 | Redisクライアント |
| `amqp` | 5.3.1 | AMQPプロトコルライブラリ（Celery依存） |
| `billiard` | 4.2.1 | Celeryのプロセスプール（multiprocessing fork） |
| `click` | 8.1.8 | Celery CLIのコマンドフレームワーク |
| `click-didyoumean` | 0.3.1 | Celery CLI拡張 |
| `click-plugins` | 1.1.1 | Celery CLI拡張 |
| `click-repl` | 0.3.0 | Celery CLI REPL |
| `tornado` | 6.4.2 | Flowerの非同期ウェブサーバー |

### Firebase・Google Cloud

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `firebase-admin` | 6.7.0 | Firebase Admin SDK（FCMプッシュ通知） |
| `google-cloud-firestore` | 2.20.1 | Cloud Firestoreクライアント |
| `google-cloud-storage` | 3.1.0 | Cloud Storageクライアント |

### 画像処理

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `pillow` | 11.0.0 | 画像処理ライブラリ（ImageField対応） |
| `brotli` | 1.0.9 | Brotli圧縮（パフォーマンス向上） |

### データベースドライバー

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `psycopg2-binary` | 2.9.10 | PostgreSQLドライバー |

### セキュリティ・暗号化

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `PyJWT` | 2.10.1 | JWT（JSON Web Token）ライブラリ |
| `cryptography` | 44.0.1 | 暗号化ライブラリ |
| `pyOpenSSL` | 25.0.0 | OpenSSLバインディング |

### ユーティリティ

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `python-dotenv` | 1.1.0 | .envファイルの読み込み |
| `requests` | 2.32.3 | HTTPクライアントライブラリ |
| `python-dateutil` | 2.9.0.post0 | 日付操作ライブラリ |
| `pytz` | 2025.1 | タイムゾーン処理 |
| `attrs` | 25.1.0 | クラス定義補助 |

### WebSocket・通信（Twisted系）

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `twisted` | 24.11.0 | 非同期ネットワークフレームワーク（Daphne依存） |
| `txaio` | 23.1.1 | Twisted/asyncioブリッジ |
| `autobahn` | 24.4.2 | WebSocket・WAMPライブラリ |
| `hyperlink` | 21.0.0 | URLライブラリ |
| `constantly` | 23.10.4 | 定数定義ライブラリ（Twisted依存） |
| `incremental` | 24.7.2 | バージョン管理（Twisted依存） |

---

## インストール済みDjangoアプリ（INSTALLED_APPS）

### フレームワーク・サードパーティ

| アプリ | パッケージ | 説明 |
|--------|----------|------|
| `daphne` | daphne | ASGIサーバー（先頭に配置要） |
| `channels` | channels | WebSocket対応 |
| `django.contrib.admin` | Django | 管理画面 |
| `django.contrib.auth` | Django | 認証フレームワーク |
| `django.contrib.contenttypes` | Django | コンテンツタイプフレームワーク |
| `django.contrib.sessions` | Django | セッション管理 |
| `django.contrib.messages` | Django | メッセージフレームワーク |
| `django.contrib.staticfiles` | Django | 静的ファイル管理 |
| `rest_framework` | DRF | REST APIフレームワーク |
| `rest_framework_simplejwt` | simplejwt | JWT認証 |
| `corsheaders` | django-cors-headers | CORSヘッダー |
| `sslserver` | django-sslserver | 開発用SSLサーバー |
| `django_celery_beat` | django-celery-beat | Celeryスケジューラ |

### カスタムアプリ（13アプリ）

| アプリ | 説明 |
|--------|------|
| `api` | サンプル・動作確認用API |
| `users` | ユーザー管理・認証 |
| `homes` | ホーム・世帯管理 |
| `announce` | お知らせ |
| `album` | アルバム・写真管理 |
| `todo` | TODOリスト |
| `reminder` | リマインダー |
| `post` | 投稿・SNS機能 |
| `chat` | リアルタイムチャット |
| `cost` | 家計管理・清算 |
| `schedule` | カレンダー・スケジュール |
| `activity` | アクティビティログ |

---

## 環境別設定ファイル

| ファイル | 説明 |
|--------|------|
| `backend/settings/base.py` | 共通設定 |
| `backend/settings/dev.py` | 開発環境設定（`CORS_ALLOW_ALL_ORIGINS=True`） |
| `backend/settings/prod.py` | 本番環境設定（ドメイン指定のCORS） |
| `backend/settings/__init__.py` | 環境選択エントリーポイント |

環境は `DJANGO_ENV` 環境変数で切り替え（デフォルト: `dev`）。

---

## 依存関係数サマリー

| 区分 | 数 |
|------|---|
| コアDjango・REST | 8 |
| 非同期・WebSocket | 4 |
| タスクキュー・非同期処理 | 10 |
| Firebase・Google Cloud | 3 |
| 画像処理 | 2 |
| データベース | 1 |
| セキュリティ | 3 |
| ユーティリティ | 5 |
| WebSocket・通信（Twisted系） | 6 |
| **合計** | **42** |

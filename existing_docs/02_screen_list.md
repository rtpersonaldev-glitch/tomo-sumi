# 画面一覧

## ルーティング定義

React Router v6 を使用。全ページは `src/pages/` 以下に配置。

---

## 非ログイン画面（パブリック）

| ルート | コンポーネント | 画面名 | 説明 |
|--------|--------------|--------|------|
| `/login` | Login | ログイン | メール＋パスワード認証 |
| `/sign-up` | Signup | ユーザー登録 | 新規ユーザー登録 |
| `/homeSelect` | HomeSwitcher | ホーム選択 | 所属ホームの選択または作成 |
| `/homeCreate` | HomeCreate | ホーム作成 | 新規世帯の作成 |

---

## ログイン後画面（プロテクト）

すべての画面はLayoutコンポーネント（Header + Footer付き）でラップされる。

### ダッシュボード・共通

| ルート | コンポーネント | 画面名 | 説明 |
|--------|--------------|--------|------|
| `/home` | Home | ホーム（ダッシュボード） | メンバー状態・スケジュール・リマインダー・お知らせを一覧表示 |
| `/apps` | Apps | アプリ一覧 | 各機能へのナビゲーションハブ |
| `/activity/` | Activity | アクティビティ | 操作ログ・タイムライン表示 |

### ユーザー・ホーム管理

| ルート | コンポーネント | 画面名 | 説明 |
|--------|--------------|--------|------|
| `/user-info/:id` | UserInfo | メンバープロフィール | 特定メンバーのプロフィール・ステータス閲覧 |
| `/user-settings` | UserSettings | ユーザー設定 | ログインユーザーのプロフィール編集 |
| `/app-settings` | ApplicationSettings | アプリ設定 | 通知設定・アプリ全体の設定 |
| `/home-info` | HomeDetail | ホーム詳細 | 世帯情報・招待コードの確認 |
| `/home-settings` | HomeSettings | ホーム設定 | 世帯名・画像の編集 |

### お知らせ

| ルート | コンポーネント | 画面名 | 説明 |
|--------|--------------|--------|------|
| `/announce/*` | AnnounceControl | お知らせ（親ルート） | お知らせ機能の各サブ画面 |
| `/announce/` | AnnounceOverview | お知らせ一覧 | 優先度・検索・フィルタ付き一覧 |
| `/announce/:id` | AnnounceDetail | お知らせ詳細 | 詳細内容・いいね・プッシュ通知 |
| `/announce/edit/:id` | AnnounceEdit | お知らせ編集 | 作成・編集フォーム |

### アルバム

| ルート | コンポーネント | 画面名 | 説明 |
|--------|--------------|--------|------|
| `/album/*` | AlbumControl | アルバム（親ルート） | アルバム機能の各サブ画面 |
| `/album/` | AlbumOverview | アルバム一覧 | 全アルバムの一覧 |
| `/album/:id` | AlbumDetail | アルバム詳細 | アルバム内の写真一覧 |
| `/album/edit/:id` | AlbumEdit | アルバム編集 | 写真アップロード・トリミング |

### 投稿（SNS）

| ルート | コンポーネント | 画面名 | 説明 |
|--------|--------------|--------|------|
| `/post/*` | PostControl | 投稿（親ルート） | 投稿機能の各サブ画面 |
| `/post/` | PostOverview | 投稿一覧 | タイムライン形式での一覧 |
| `/post/:id` | PostDetail | 投稿詳細 | 内容・コメント・いいね |
| `/post/edit/:id` | PostEdit | 投稿編集 | リッチテキストエディタで作成・編集 |

### チャット

| ルート | コンポーネント | 画面名 | 説明 |
|--------|--------------|--------|------|
| `/chat` | ChatRoom | チャット | リアルタイムメッセージング（WebSocket） |

### カレンダー・スケジュール

| ルート | コンポーネント | 画面名 | 説明 |
|--------|--------------|--------|------|
| `/calendar/*` | ScheduleControl | カレンダー（親ルート） | スケジュール機能の各サブ画面 |
| `/calendar/` | ScheduleOverview | スケジュール一覧 | FullCalendarによるカレンダー表示 |
| `/calendar/:id` | ScheduleDetail | スケジュール詳細 | 予定の詳細内容 |
| `/calendar/edit/:id` | ScheduleEdit | スケジュール編集 | 予定の作成・編集 |

### TODOリスト

| ルート | コンポーネント | 画面名 | 説明 |
|--------|--------------|--------|------|
| `/todo/*` | TodoControl | TODO（親ルート） | TODO機能の各サブ画面 |
| `/todo/` | TodoOverview | TODO一覧 | 全TODOリストの一覧 |
| `/todo/edit/:id` | TodoEdit | TODO編集 | チェックリスト形式での編集 |

### リマインダー

| ルート | コンポーネント | 画面名 | 説明 |
|--------|--------------|--------|------|
| `/reminder/*` | ReminderControl | リマインダー（親ルート） | リマインダー機能の各サブ画面 |
| `/reminder/` | ReminderOverview | リマインダー一覧 | 全リマインダーグループの一覧 |
| `/reminder/group/edit/:id` | ReminderGroupEdit | リマインダーグループ編集 | グループの作成・編集 |
| `/reminder/contents/edit/:id` | ReminderContentsEdit | リマインダー内容編集 | リマインダー内容の作成・編集・繰り返し設定 |

### 家計管理

| ルート | コンポーネント | 画面名 | 説明 |
|--------|--------------|--------|------|
| `/expense/*` | CostControl | 家計管理（親ルート） | 家計機能の各サブ画面 |
| `/expense/` | CostOverview | 支出一覧 | 未清算の支出一覧・フィルタ |
| `/expense/:id` | CostDetail | 支出詳細 | レシート画像・内訳詳細 |
| `/expense/edit/:id` | CostEdit | 支出編集 | 支出の作成・編集 |
| `/expense/summary` | CostSummary | 集計・サマリー | カテゴリ・ユーザー・期間別グラフ |
| `/expense/seisan` | CostSeisan | 清算 | 精算処理・未清算/清算済み一覧 |

---

## 特殊コンポーネント（ページではないが共通レイアウト）

| コンポーネント | 説明 |
|--------------|------|
| Layout | 全保護ページの外枠。Header + Footer をラップ |
| Header | ナビゲーション・ユーザーメニュー |
| Footer | アクティビティ通知バッジ・底部ナビゲーション |
| PrivateRoute | `isUserLogin` + `isHomeLogin` の両方を確認して認証チェック |

---

## 画面数サマリー

| 区分 | 画面数 |
|------|--------|
| 非ログイン画面 | 4 |
| ログイン後画面 | 21+ |
| 合計 | 25+ |

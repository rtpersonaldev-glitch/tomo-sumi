# React依存関係

## プロジェクト基本情報

| 項目 | 内容 |
|------|------|
| プロジェクト名 | LifeSync-web |
| バージョン | 0.1.0 |
| フレームワーク | React 18 + TypeScript |
| ビルドツール | Craco（Create React App Configuration Override） |
| スタイリング | SCSS（Sass） |

---

## 本番依存関係（dependencies）

### コアフレームワーク

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `react` | ^18.3.1 | Reactコアライブラリ |
| `react-dom` | ^18.3.1 | ReactのDOM操作 |
| `react-scripts` | 5.0.1 | CRAビルドスクリプト |
| `typescript` | ^4.9.5 | TypeScript |

### ルーティング

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `react-router-dom` | ^6.27.0 | SPAルーティング（React Router v6） |

### HTTP通信

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `axios` | ^1.7.9 | HTTPクライアント（インストール済みだが主にfetch APIを使用） |

### UIコンポーネント・アイコン

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `react-icons` | ^5.3.0 | アイコンライブラリ |
| `framer-motion` | ^12.6.0 | アニメーションライブラリ |
| `@popperjs/core` | ^2.11.8 | ポップオーバー位置決めエンジン |
| `react-popper` | ^2.3.0 | Reactのポップオーバーコンポーネント |

### カレンダー

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `@fullcalendar/react` | ^6.1.15 | Reactカレンダーコンポーネント |
| `@fullcalendar/core` | ^6.1.15 | FullCalendarコア |
| `@fullcalendar/daygrid` | ^6.1.15 | 月・週グリッド表示 |

### グラフ・チャート

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `recharts` | ^2.15.1 | 家計集計グラフ（棒グラフ等） |

### 画像処理

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `react-cropper` | ^2.3.3 | 画像トリミングUIコンポーネント |
| `cropperjs` | ^1.6.2 | 画像トリミングコアライブラリ |

### リッチテキストエディタ

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `@tiptap/react` | ^2.9.1 | TipTap Reactインテグレーション |
| `@tiptap/starter-kit` | ^2.9.1 | TipTapスターターキット（基本機能セット） |
| `@tiptap/extension-bold` | ^2.9.1 | 太字拡張 |
| `@tiptap/extension-color` | ^2.9.1 | 文字色拡張 |
| `@tiptap/extension-link` | ^2.9.1 | リンク拡張 |
| `@tiptap/extension-mention` | ^2.9.1 | メンション拡張 |
| `@tiptap/extension-placeholder` | ^2.9.1 | プレースホルダー拡張 |
| `@tiptap/extension-text-align` | ^2.9.1 | テキスト整列拡張 |
| `draft-js` | ^0.11.7 | Draft.jsエディタ（投稿機能で使用） |

### Firebase

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `firebase` | ^11.4.0 | Firebase SDK（FCMプッシュ通知） |

### WebSocket

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `socket.io-client` | ^4.8.1 | Socket.IOクライアント（インストール済みだが未使用・WebSocket APIを直接使用） |

### 通知・UI

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `react-toastify` | ^10.0.6 | トースト通知 |

### SEO・メタタグ

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `react-helmet-async` | ^2.0.5 | ページタイトル・メタタグ管理 |
| `react-helmet` | ^6.1.0 | ページタイトル・メタタグ管理（旧バージョン） |

### ユーティリティ

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `date-fns` | ^4.1.0 | 日付操作・フォーマット |
| `uuid` | ^11.1.0 | UUID生成 |
| `js-cookie` | ^3.0.5 | クッキー操作 |
| `classnames` | ^2.5.1 | 条件付きclassName結合 |

### スタイリング

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `sass` | ^1.79.5 | SCSS/SASSコンパイラ |

### パフォーマンス計測

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `web-vitals` | ^2.1.4 | Core Web Vitals計測 |

---

## 開発依存関係（devDependencies）

### ビルドツール

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `@craco/craco` | ^7.1.0 | CRAの設定オーバーライドツール |
| `rimraf` | ^6.0.1 | クロスプラットフォームのファイル削除 |

### コード品質

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `eslint` | ^8.57.1 | JavaScriptリンター |
| `eslint-config-prettier` | ^9.1.0 | ESLint + Prettier競合解消 |
| `eslint-plugin-prettier` | ^5.2.1 | ESLintにPrettierを統合 |
| `prettier` | ^3.3.3 | コードフォーマッター |

### テスト

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `@testing-library/react` | ^13.4.0 | Reactコンポーネントテスト |
| `@testing-library/jest-dom` | ^5.17.0 | JestのDOMマッチャー拡張 |
| `@testing-library/user-event` | ^13.5.0 | ユーザー操作シミュレーション |

---

## 型定義（@types）

| パッケージ | バージョン | 用途 |
|----------|----------|------|
| `@types/react` | ^18.3.11 | React型定義 |
| `@types/react-dom` | ^18.3.1 | ReactDOM型定義 |
| `@types/react-router-dom` | ^5.3.3 | React Router型定義 |
| `@types/jest` | ^27.5.2 | Jest型定義 |
| `@types/node` | ^16.18.113 | Node.js型定義 |
| `@types/draft-js` | ^0.11.18 | Draft.js型定義 |
| `@types/js-cookie` | ^3.0.6 | js-cookie型定義 |
| `@types/react-helmet-async` | ^1.0.3 | react-helmet-async型定義 |

---

## 状態管理方針

| 方式 | 採用状況 | 用途 |
|------|---------|------|
| React Context API | ○ | 認証状態（AuthContext）の全体管理 |
| useState | ○ | 各コンポーネントのローカル状態 |
| localStorage | ○ | テーマ設定（dark/light）の永続化 |
| sessionStorage | ○ | 一時的なデータ保持（sessionStorageUtil） |
| Redux | ✗ | 未使用 |
| Zustand | ✗ | 未使用 |

---

## 依存関係数サマリー

| 区分 | 数 |
|------|---|
| 本番依存関係（dependencies） | 32 |
| 開発依存関係（devDependencies） | 11 |
| 型定義（@types） | 8 |
| **合計** | **51** |

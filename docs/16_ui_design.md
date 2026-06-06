# UI デザインガイドライン

> **Claude Codeへ：** UI を実装する前に必ずこのファイルを読んでください。  
> ワイヤーフレームをユーザーに提示して承認を得てから実装に進んでください。

---

## デザインコンセプト

**"家族の温かみ × 整理された暮らし"**

| 方針 | 内容 |
|------|------|
| **温かみ** | 硬すぎず柔らかい色調・丸みのあるコンポーネント |
| **視認性** | 情報量が多い家族アプリのため、階層と余白を丁寧に設計 |
| **ファーストクラスの日本語** | 日本語を読みやすくするフォントサイズ・行間 |
| **ダークモード** | ライトモードと同等の品質で設計する（後付けにしない） |
| **アクセシビリティ** | WCAG 2.1 AA 準拠・フォーカスリング・ARIA ラベル必須 |

---

## カラーパレット

shadcn/ui の CSS 変数（`globals.css`）に基づく。ブランドカラーは **Teal**。

### ブランドカラー（HEX）

| 役割 | HEX | HSL | 用途 |
|------|-----|-----|------|
| Primary | `#37ab9d` | `173 51% 44%` | アクションボタン・リンク |
| Primary Light | `#4dc0b2` | `173 48% 53%` | ホバー・フォーカスリング |
| Accent | `#ffc042` | `40 100% 63%` | ハイライト・バッジ（Warm Amber） |
| Muted FG | `#586365` | `189 7% 37%` | 補助テキスト・外出ステータス |

### ライトモード

| 変数 | 値（HSL） | 用途 |
|------|-----------|------|
| `--background` | `40 20% 97%` | ページ背景（温かいオフホワイト） |
| `--foreground` | `220 15% 12%` | 本文テキスト |
| `--primary` | `173 51% 44%` | アクションボタン・リンク（#37ab9d） |
| `--primary-foreground` | `0 0% 100%` | プライマリボタン上のテキスト |
| `--secondary` | `173 20% 92%` | セカンダリ背景 |
| `--muted` | `189 10% 90%` | プレースホルダー・区切り線背景 |
| `--muted-foreground` | `189 7% 37%` | 補助テキスト（#586365） |
| `--accent` | `40 100% 63%` | ハイライト・バッジ（#ffc042） |
| `--destructive` | `0 72% 51%` | 削除・エラー |
| `--border` | `173 15% 88%` | ボーダー |
| `--card` | `0 0% 100%` | カード背景 |
| `--ring` | `173 48% 53%` | フォーカスリング（#4dc0b2） |

### ダークモード

| 変数 | 値（HSL） | 用途 |
|------|-----------|------|
| `--background` | `189 20% 8%` | ページ背景（深いティール） |
| `--foreground` | `173 15% 94%` | 本文テキスト |
| `--primary` | `173 48% 53%` | アクションボタン（明るめ・#4dc0b2） |
| `--card` | `189 20% 12%` | カード背景 |
| `--muted` | `189 15% 16%` | ミュート背景 |
| `--border` | `189 15% 20%` | ボーダー |

### セマンティックカラー（アプリ固有）

```css
/* ステータスカラー */
--status-at-home: 142 71% 45%;   /* 在宅: green-500 */
--status-away: 189 7% 37%;       /* 外出: #586365 */

/* 優先度カラー（お知らせ） */
--priority-high: 0 72% 51%;      /* red-500 */
--priority-medium: 40 100% 63%;  /* #ffc042 */
--priority-low: 189 7% 37%;      /* #586365 */
```

---

## タイポグラフィ

| スケール | クラス | サイズ | ウェイト | 用途 |
|---------|--------|--------|---------|------|
| Display | `text-3xl font-bold` | 30px | 700 | ページタイトル（PCのみ） |
| H1 | `text-2xl font-semibold` | 24px | 600 | セクション見出し |
| H2 | `text-xl font-semibold` | 20px | 600 | カード見出し |
| H3 | `text-base font-medium` | 16px | 500 | サブ見出し |
| Body | `text-sm` | 14px | 400 | 本文 |
| Caption | `text-xs text-muted-foreground` | 12px | 400 | 補助情報・タイムスタンプ |

**フォントファミリー：** `font-sans`（システムフォント → -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif）

---

## スペーシング・サイジング

| 要素 | 値 |
|------|-----|
| カード角丸 | `rounded-xl`（12px） |
| ボタン角丸 | `rounded-lg`（8px）/ 全丸 `rounded-full` |
| 入力フィールド角丸 | `rounded-lg`（8px） |
| カードシャドウ（ライト） | `shadow-sm` |
| カードシャドウ（ダーク） | `border border-border`（シャドウなし） |
| セクション間余白 | `space-y-6` or `gap-6` |
| カード内パディング | `p-4` or `p-6` |

---

## レイアウト構成

### デスクトップ（md: 768px 以上）

```
┌──────────────────────────────────────────────────────────┐
│ Sidebar (260px固定)  │ Main Content (flex-1)              │
│                     │                                    │
│ ロゴ + ホーム名      │ ページコンテンツ（max-w-5xl）       │
│ ─────────────────   │                                    │
│ ナビゲーションリスト │                                    │
│                     │                                    │
│ ─────────────────   │                                    │
│ ユーザーアバター     │                                    │
│ ステータス切替       │                                    │
└──────────────────────────────────────────────────────────┘
```

### モバイル（md 未満）

```
┌─────────────────────────┐
│ Header (56px)           │
│ ホーム名      [🔔] [👤] │
├─────────────────────────┤
│                         │
│ ページコンテンツ         │
│ (スクロール可)           │
│                         │
├─────────────────────────┤
│ Bottom Tab Bar (64px)   │
│  🏠  💬  📋  📅  ⋯    │
└─────────────────────────┘
```

### ページ最大幅

| 場面 | 値 |
|------|-----|
| 通常コンテンツ | `max-w-5xl mx-auto` |
| フォーム・詳細 | `max-w-2xl mx-auto` |
| チャット | `max-w-3xl mx-auto`（高さ固定） |

---

## ナビゲーション構成

### サイドバー（デスクトップ）

| アイコン | ラベル | ルート |
|---------|--------|--------|
| Home | ホーム | `/home` |
| MessageCircle | チャット | `/chat` |
| Newspaper | 投稿 | `/posts` |
| Calendar | カレンダー | `/schedules` |
| Bell | お知らせ | `/announces` |
| CheckSquare | TODO | `/todos` |
| AlarmClock | リマインダー | `/reminders` |
| Wallet | 家計 | `/costs` |
| Image | アルバム | `/albums` |
| Activity | アクティビティ | `/activity` |

### ボトムナビ（モバイル）

| アイコン | ラベル | ルート |
|---------|--------|--------|
| Home | ホーム | `/home` |
| MessageCircle | チャット | `/chat` |
| Newspaper | 投稿 | `/posts` |
| Calendar | カレンダー | `/schedules` |
| LayoutGrid | メニュー | `/menu`（全機能） |

---

## コンポーネントガイドライン

### ボタン

```tsx
// プライマリ（shadcn Button variant="default"）
<Button>送信</Button>

// セカンダリ
<Button variant="outline">キャンセル</Button>

// 危険操作
<Button variant="destructive">削除</Button>

// アイコン付き
<Button>
  <Plus className="mr-2 h-4 w-4" />
  作成
</Button>
```

### カード

```tsx
// 基本カード
<Card className="rounded-xl">
  <CardHeader>
    <CardTitle>見出し</CardTitle>
  </CardHeader>
  <CardContent>内容</CardContent>
</Card>
```

### ステータスバッジ

```tsx
// 在宅
<span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
  在宅
</span>
```

### ユーザーアバター（with ステータスドット）

```tsx
<div className="relative inline-block">
  <Avatar className="h-10 w-10">
    <AvatarImage src={iconPath} />
    <AvatarFallback>{nickname[0]}</AvatarFallback>
  </Avatar>
  {/* ステータスドット */}
  <span className={cn(
    "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
    status === "at_home" ? "bg-green-500" : "bg-slate-400"
  )} />
</div>
```

---

## アクセシビリティ規則

| ルール | 内容 |
|--------|------|
| フォーカスリング | `focus-visible:ring-2 focus-visible:ring-ring` を全インタラクティブ要素に |
| カラーコントラスト | WCAG AA（4.5:1 以上）を必ず確認 |
| ARIAラベル | アイコンのみのボタンは `aria-label` 必須 |
| フォームエラー | `aria-describedby` でエラーメッセージを紐付け |
| 画像 | 装飾画像は `alt=""` / 意味のある画像は適切な alt |
| キーボード操作 | Tab順序・Escape/Enter キーによる操作を保証 |

---

## ダークモード実装ルール

- `dark:` プレフィックスで必ずダークモードの見た目を指定する
- 画像の上に overlay する際は `dark:bg-black/40` 等で調整
- シャドウはダークモードでは border に切り替える（`dark:shadow-none dark:border`）
- カラーコードを直書きせず、必ず CSS 変数（`bg-background`, `text-foreground` 等）を使う

---

## アニメーションガイドライン（framer-motion）

| 場面 | アニメーション |
|------|--------------|
| ページ遷移 | `opacity 0→1, y: 8→0, duration: 0.2s` |
| カード出現 | `staggerChildren 0.05s` |
| モーダル | `scale 0.95→1, opacity 0→1, duration: 0.15s` |
| トースト | sonner デフォルト |
| ボタンホバー | `hover:scale-[1.02] transition-transform` |

---

## ワイヤーフレームワークフロー

1. 画面一覧を確認（`existing_docs/02_screen_list.md`）
2. 実装対象画面の ASCII ワイヤーフレームを作成してユーザーに提示
3. 承認後、コンポーネント実装 → ページ実装の順で進める
4. 実装後は `npm run typecheck` / `npm run lint` でエラーがないことを確認

---

> **関連ドキュメント**
> - スタック詳細: [05_react_config.md](05_react_config.md)
> - コンポーネント実装規約: [09_coding_conventions.md](09_coding_conventions.md)
> - エラーUI実装: [11_error_handling.md](11_error_handling.md)

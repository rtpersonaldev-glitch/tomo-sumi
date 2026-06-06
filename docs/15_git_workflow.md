# Git ワークフロー

> **前提：** 個人開発 + Claude Code主体。GitHub Flowをシンプルに運用します。

---

## ブランチ戦略

### ブランチ構成

```
main  ←  常にデプロイ可能な状態を維持（直接pushは禁止）
 ├── feature/issue-{N}-{short-name}  ← 1Issue = 1ブランチ（通常）
 └── hotfix/{short-name}             ← 本番緊急修正のみ
```

### ブランチ命名規則

```
feature/issue-{Issue番号}-{短い説明(kebab-case)}

例:
feature/issue-2-backend-foundation
feature/issue-9-homes-api
feature/issue-20-announces-page
hotfix/login-cookie-expire
```

### マージ先とマージ方法

| ブランチ | マージ先 | マージ方法 |
|---------|---------|-----------|
| `feature/*` | `main` | **Squash merge**（履歴をきれいに保つ） |
| `hotfix/*` | `main` | **Merge commit**（緊急対応の経緯を残す） |

---

## Issue 運用

### ラベル体系

GitHubで以下のラベルを作成します。

**優先度**

| ラベル | 意味 |
|-------|------|
| `priority/P0` | 致命的・他のIssueのブロッカー |
| `priority/P1` | 高・基盤系 |
| `priority/P2` | 中・通常機能 |
| `priority/P3` | 低・オプション |

**種別**

| ラベル | 意味 |
|-------|------|
| `type/feat` | 新機能 |
| `type/fix` | バグ修正 |
| `type/docs` | ドキュメント |
| `type/test` | テスト |
| `type/chore` | 設定・依存関係 |

**フェーズ**

| ラベル | 対象Phase |
|-------|----------|
| `phase/0` | 初期セットアップ（#1） |
| `phase/1` | BE・FE基盤（#2〜#8） |
| `phase/2` | BE機能実装（#9〜#18） |
| `phase/3-4` | FE機能実装（#19〜#29） |
| `phase/5-6` | テスト・本番移行（#30〜#32） |

**ステータス**

| ラベル | 意味 |
|-------|------|
| `status/in-progress` | 現在作業中 |
| `status/blocked` | 依存Issueが未完了でブロック中 |

### Issueに着手する前のチェック

1. GitHub Issues で **依存Issue** がすべてクローズされているか確認する
2. **P0 → P1 → P2** の優先度順に着手する
3. GitHub Issues の **受け入れ条件** を読み、完了の定義を把握する

### Claude Codeへの作業指示パターン

```
（指示の例）
「Issue #9 ホームAPIを実装してください。
docs/07_api_list.md でエンドポイント仕様、docs/03_db_config.md でモデルを確認してください。
受け入れ条件は GitHub の Issue #9 を参照してください。」
```

参照すべきdocsを明示することで、AIが余計なファイルを読む時間を削減できます。

---

## PR 運用

### 基本ルール

**1 Issue = 1 PR** を原則とします。  
大きいIssue（例: #2 バックエンド基盤）は複数PRに分割しても構いません。

### PRタイトル形式

```
#{Issue番号} {種別}: {日本語の説明}

例:
#9 feat: ホーム管理API（CRUD・招待・参加）を実装
#2 chore: バックエンド基盤（DB接続・設定・マイグレーション）を構築
#30 test: 全機能のpytestテストを追加
#5 fix: リフレッシュトークン期限切れ時に401が返らない問題を修正
```

### PR本文テンプレート

```markdown
## 対応Issue
closes #{Issue番号}

## 変更内容
- （変更点を箇条書き）

## 動作確認
- [ ] `docker compose -f docker-compose.dev.yml up -d` で起動確認
- [ ] 実装機能の動作確認（または `pytest` の実行確認）
- [ ] `ruff check` / `mypy --strict` がエラーなし（BE）
- [ ] `tsc --noEmit` がエラーなし（FE）
- [ ] 不要な `console.log` / デバッグコードがないか確認

## 備考
（Claude Codeセッションで判断したこと・注意点など）
```

### マージ後の後処理

```bash
# ローカルブランチを削除
git branch -d feature/issue-{N}-{description}

# リモートブランチを削除（GitHub UI でも可）
git push origin --delete feature/issue-{N}-{description}

# mainを最新化
git checkout main && git pull
```

---

## コミットルール

コミットメッセージの形式と種別（`feat:` / `fix:` 等）は **[09_coding_conventions.md](09_coding_conventions.md)** を参照してください。

### Claude Code セッション内でのコミット粒度

「論理的にひとまとまりになるタイミング」でコミットします。

| 良いコミットタイミング | 例 |
|-------------------|----|
| スキーマ定義が完了したとき | `feat: お知らせのPydanticスキーマを定義` |
| 1エンドポイントが動作したとき | `feat: GET /api/announces を実装` |
| テストが通ったとき | `test: お知らせ一覧APIのpytestを追加` |
| 設定ファイルを変更したとき | `chore: asyncpg・alembicをpyproject.tomlに追加` |

ファイル単位やAIの「返答1回」でコミットしない。機能として区切れるタイミングでまとめる。

### Co-Authored-By（自動付与）

Claude Codeが生成したコードのコミットには、Claude Codeが自動的に以下を付与します：

```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

特別な設定は不要です。

---

## 1セッションの開発フロー

```
1. Issueを確認する
   → GitHub Issues で受け入れ条件・依存Issueを読む

2. ブランチを作成する
   git checkout main && git pull
   git checkout -b feature/issue-{N}-{description}

3. Claude Codeに実装を依頼する
   → 「docs/07_api_list.md の #{機能} を実装してください」のように
     参照するdocsを明示して依頼する

4. 論理的な区切りでコミットする
   git add {具体的なファイル名}
   git commit -m "feat: {説明}"

5. PRを作成する
   gh pr create --title "#{N} feat: ..." --body "..."

6. セルフレビューしてSquash mergeする
   → PRの差分を確認 → Squash merge → Issueが自動クローズされる

7. ブランチを削除する
   git branch -d feature/issue-{N}-{description}
```

---

## GitHub 推奨設定

### main ブランチの保護

Settings → Branches → Branch protection rules：

- ✅ Require a pull request before merging
- ✅ Do not allow bypassing the above settings

### デフォルトマージ方法

Settings → General → Pull Requests：

- ✅ Allow squash merging（デフォルトに設定）
- ✅ Automatically delete head branches（マージ後に自動削除）

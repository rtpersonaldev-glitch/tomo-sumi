# DBテーブル一覧

## 共通フィールド

以下のフィールドはほぼ全テーブルに存在する共通カラム。

| フィールド名 | 型 | 説明 |
|------------|----|----|
| `id` | BigAutoField | 主キー（自動採番） |
| `created_by` | CharField / FK | 作成者 |
| `created_at` | DateTimeField | 作成日時 |
| `updated_by` | CharField / FK | 更新者 |
| `updated_at` | DateTimeField | 更新日時 |

---

## users アプリ

### CustomUser（カスタムユーザー）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `email` | EmailField | No | メールアドレス（ユーザー識別子、unique） |
| `nickname` | CharField(50) | No | 表示名 |
| `icon` | ImageField | Yes | プロフィール画像 |
| `status` | CharField | No | 在宅ステータス（`at_home` / `away`） |
| `notification_flag` | BooleanField | No | 通知フラグ（default: True） |
| `return_time` | DateTimeField | Yes | 帰宅予定時刻 |
| `last_active` | DateTimeField | No | 最終アクティブ日時（auto_now） |
| `selectedHome` | FK(Homes) | Yes | 現在選択中のホーム |
| `is_active` | BooleanField | No | アカウント有効フラグ |
| `is_staff` | BooleanField | No | スタッフフラグ |

### FCMToken（Firebase通知トークン）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `user` | FK(CustomUser) | No | ユーザー |
| `token` | CharField | No | FCMトークン（unique） |
| `created_at` | DateTimeField | No | 作成日時 |

---

## homes アプリ

### Homes（ホーム・世帯）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `name` | CharField(50) | No | ホーム名 |
| `homeImage` | ImageField | Yes | ホームアイコン画像 |

### HomeLinks（ユーザー・ホーム紐付け）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `user_id` | FK(CustomUser) | No | ユーザー |
| `home_id` | FK(Homes) | No | ホーム |
| `deleted_at` | DateTimeField | Yes | 論理削除日時 |

### InvitationCode（招待コード）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `home_id` | FK(Homes) | No | 対象ホーム |
| `code` | CharField(50) | No | 招待コード文字列 |
| `used` | BooleanField | No | 使用済みフラグ（default: False） |

---

## announce アプリ

### Announces（お知らせ）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `home_id` | FK(Homes) | No | 対象ホーム |
| `title` | CharField(50) | No | タイトル |
| `content` | CharField(300) | No | 本文 |
| `priority` | CharField | No | 優先度（`high` / `medium` / `low`） |
| `end_date` | DateField | No | 掲示終了日 |

### announceLike（お知らせいいね）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `announce_id` | FK(Announces) | No | お知らせ |
| `user_id` | FK(CustomUser) | No | いいねしたユーザー |

---

## album アプリ

### Albums（アルバム）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `title` | CharField(50) | No | アルバム名 |
| `home_id` | FK(Homes) | No | 対象ホーム |

### pictures（写真）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `homeImage` | ImageField | No | 写真ファイル |
| `album_id` | FK(Albums) | No | 所属アルバム |

---

## todo アプリ

### Todos（TODOリスト）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `home_id` | FK(Homes) | No | 対象ホーム |
| `title` | CharField(50) | No | リスト名 |
| `complete_flg` | BooleanField | No | 完了フラグ（default: False） |

### TodoContents（TODO項目）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `todo_id` | FK(Todos) | No | 所属TODOリスト |
| `content` | CharField(50) | No | 項目内容 |
| `check_flg` | BooleanField | No | チェックフラグ（default: False） |

---

## reminder アプリ

### Reminders（リマインダーグループ）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `home_id` | FK(Homes) | No | 対象ホーム |
| `list_name` | CharField(50) | No | グループ名 |
| `complete_flg` | BooleanField | No | 完了フラグ（default: False） |

### RemindersContents（リマインダー内容）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `reminder_id` | FK(Reminders) | No | 所属グループ |
| `title` | CharField(50) | No | タイトル |
| `memo` | CharField(100) | No | メモ |
| `date` | DateField | Yes | 通知日 |
| `time` | TimeField | Yes | 通知時刻 |
| `repeat` | CharField | Yes | 繰り返しパターン（1=毎日〜9=毎年） |
| `is_active` | BooleanField | No | アクティブフラグ（default: False） |

---

## post アプリ

### Posts（投稿）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `home_id` | FK(Homes) | No | 対象ホーム |
| `content` | JSONField | No | 本文（TipTap / Draft.jsのJSON形式） |

### PostPictures（投稿画像）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `picture` | ImageField | No | 画像ファイル |
| `post_id` | FK(Posts) | No | 所属投稿 |

### PostComments（投稿コメント）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `comment` | CharField(100) | No | コメント内容 |
| `post_id` | FK(Posts) | No | 対象投稿 |

### PostLikes（投稿いいね）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `post_id` | FK(Posts) | No | 対象投稿 |
| `user_id` | FK(CustomUser) | No | いいねしたユーザー |

### PostTags（投稿タグ）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `name` | CharField(50) | No | タグ名 |

### PostTagLinks（投稿・タグ紐付け）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `post_id` | FK(Posts) | No | 投稿 |
| `Post_tag_id` | FK(PostTags) | No | タグ |

---

## chat アプリ

### ChatMessage（チャットメッセージ）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `home_id` | FK(Homes) | No | 対象ホーム |
| `user_id` | FK(CustomUser) | No | 送信ユーザー |
| `message` | TextField | No | メッセージ本文 |
| `timestamp` | DateTimeField | No | 送信日時（auto_now_add） |

### ChatPictures（チャット画像）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `picture` | ImageField | No | 画像ファイル |
| `message_id` | FK(ChatMessage) | No | 対象メッセージ |

### ChatRead（既読管理）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `ChatMessage_id` | FK(ChatMessage) | No | 対象メッセージ |

---

## cost アプリ

### Category（カテゴリ）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `name` | CharField(30) | No | カテゴリ名 |
| `home_id` | FK(Homes) | No | 対象ホーム |

### Costs（支出記録）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `purchase_date` | DateField | No | 購入日 |
| `category_id` | FK(Category) | Yes | カテゴリ |
| `amount` | IntegerField | No | 金額 |
| `shiharai_user` | FK(CustomUser) | Yes | 支払いユーザー |
| `image` | ImageField | Yes | レシート画像 |
| `method` | CharField | No | 支払い方法 |
| `memo` | CharField(100) | No | メモ |
| `dish_count` | IntegerField | Yes | 食数 |
| `seisan_id` | FK(Seisan) | Yes | 紐付く清算レコード |
| `home_id` | FK(Homes) | No | 対象ホーム |

### Seisan（清算レコード）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `title` | CharField(50) | No | 清算タイトル |
| `complete_flg` | BooleanField | No | 完了フラグ（default: False） |
| `home_id` | FK(Homes) | No | 対象ホーム |
| `touroku_date` | CharField(50) | No | 登録日 |

### SeisanMeisai（清算明細）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `cost` | IntegerField | No | 金額 |
| `complete_flg` | BooleanField | No | 完了フラグ（default: False） |
| `from_user` | FK(CustomUser) | Yes | 支払いユーザー（支払う側） |
| `to_user` | FK(CustomUser) | Yes | 受取ユーザー（受け取る側） |
| `seisan_id` | FK(Seisan) | No | 清算レコード |

### Seikyusaki（請求先）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `shiharai_user` | FK(CustomUser) | Yes | 支払いユーザー |
| `dish_count` | IntegerField | Yes | 食数 |
| `cost` | IntegerField | No | 金額 |
| `cost_id` | FK(Costs) | No | 対象支出 |

### AutoSeisan（自動清算設定）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `execute_flg` | BooleanField | No | 自動清算ON/OFF（default: False） |
| `seisan_date` | CharField | No | 清算実行日（月の何日か） |
| `home_id` | FK(Homes) | No | 対象ホーム |

### Koteihi（固定費）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `category_id` | FK(Category) | Yes | カテゴリ |
| `cost` | IntegerField | No | 金額 |
| `from_user` | FK(CustomUser) | Yes | 支払いユーザー |
| `to_user` | FK(CustomUser) | Yes | 受取ユーザー |
| `memo` | CharField(100) | No | メモ |
| `home_id` | FK(Homes) | No | 対象ホーム |

---

## schedule アプリ

### Schedules（スケジュール）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | BigAutoField | No | 主キー |
| `start_day` | DateTimeField | No | 開始日時 |
| `end_day` | DateTimeField | No | 終了日時 |
| `title` | CharField(100) | No | タイトル |
| `memo` | CharField(100) | No | メモ |
| `home_id` | FK(Homes) | No | 対象ホーム |

---

## activity アプリ

### ActivityLog（アクティビティログ）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | AutoField | No | 主キー |
| `user` | CharField | No | 操作ユーザー名 |
| `action` | CharField | No | 操作内容の説明 |
| `target_model` | CharField | No | 操作対象モデル名 |
| `target_id` | IntegerField | Yes | 操作対象レコードID |
| `home_id` | FK(Homes) | No | 対象ホーム |
| `created_at` | DateTimeField | No | 作成日時 |
| `read_by` | M2M(CustomUser) | - | 既読ユーザー（through: ActivityReadStatus） |

### ActivityReadStatus（既読管理）

| フィールド名 | 型 | NULL | 説明 |
|------------|----|----|------|
| `id` | AutoField | No | 主キー |
| `user` | FK(CustomUser) | No | ユーザー |
| `activity` | FK(ActivityLog) | No | アクティビティ |
| `read_at` | DateTimeField | Yes | 既読日時 |

> **Unique制約:** (`user`, `activity`) の組み合わせはユニーク

---

## テーブル数サマリー

| アプリ | テーブル数 |
|--------|----------|
| users | 2 |
| homes | 3 |
| announce | 2 |
| album | 2 |
| todo | 2 |
| reminder | 2 |
| post | 6 |
| chat | 3 |
| cost | 7 |
| schedule | 1 |
| activity | 2 |
| **合計** | **32** |

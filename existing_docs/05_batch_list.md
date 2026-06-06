# バッチ一覧

## 非同期タスク基盤

| 項目 | 内容 |
|------|------|
| タスクキュー | Celery 5.4.0 |
| ブローカー | Redis（localhost:6379/0） |
| バックエンド | Redis（localhost:6379/0） |
| スケジューラ | django-celery-beat（DBベースの動的スケジューリング） |
| タイムゾーン | Asia/Tokyo |
| シリアライザ | JSON |
| モニタリング | Flower 2.0.1 |

---

## バッチ・タスク一覧

### 1. 月末自動清算（run_month_end_closure）

| 項目 | 内容 |
|------|------|
| タスク名 | `cost.tasks.run_month_end_closure` |
| 実行スケジュール | 毎日 23:59（crontab: minute=59, hour=23） |
| トリガー | 定期実行（Celery Beat） |

**処理概要:**

各ホームの `AutoSeisan` 設定を参照し、当日が清算日である場合に自動で清算処理を実行する。

**処理フロー:**
1. 全ホームの `AutoSeisan`（`execute_flg=True`）を取得
2. `seisan_date`（月の何日か）と当日を照合
3. 対象ホームの未清算 `Costs` レコードを収集
4. `Seisan`（清算レコード）を新規作成
5. 固定費 `Koteihi` を取得して清算に追加
6. `SeisanMeisai`（誰が誰にいくら払うか）を計算・生成
7. 対象 `Costs` レコードに `seisan_id` を紐付けて更新

---

### 2. リマインダー通知（send_reminder）

| 項目 | 内容 |
|------|------|
| タスク名 | `reminder.tasks.send_reminder` |
| 実行スケジュール | 動的（リマインダー内容の `date` + `time` に基づく） |
| トリガー | リマインダー保存時に `create_or_update_reminder_task()` が PeriodicTask を生成 |
| 最大リトライ | 1回 |

**処理概要:**

`RemindersContents` の `is_active=True` かつ指定日時になった際に、対象ホームの全メンバーにFirebase FCMプッシュ通知を送信する。

**繰り返しパターン:**

| コード | 繰り返し |
|--------|---------|
| 1 | 毎日 |
| 2 | 平日（月〜金） |
| 3 | 週末（土・日） |
| 4 | 毎週日曜 |
| 5 | 隔週 |
| 6 | 毎月1日 |
| 7 | 四半期ごと（3ヶ月ごと） |
| 8 | 半年ごと |
| 9 | 毎年 |

**処理フロー:**
1. `reminder_content_id` で `RemindersContents` を取得
2. `is_active` の確認
3. 対象ホームのメンバーに紐付く `FCMToken` を収集
4. `utils/fcm.py` の `send_push_notification()` を呼び出してFCM通知を送信
5. 繰り返し設定がある場合は次回の `PeriodicTask` を更新

---

## 管理コマンド（management commands）

バックエンドの `management/commands/` ディレクトリに格納されている手動実行可能なコマンド。  
詳細は確認中（プロジェクト探索時点では Celery タスクが主な自動処理）。

---

## Celery Beat 設定例

```python
# settings/base.py（抜粋）
CELERY_BEAT_SCHEDULE = {
    'run-month-end-closure-daily': {
        'task': 'cost.tasks.run_month_end_closure',
        'schedule': crontab(minute=59, hour=23),
    },
}
```

---

## バッチサマリー

| バッチ名 | 種類 | 実行頻度 | 主な処理 |
|---------|------|---------|---------|
| 月末自動清算 | 定期バッチ | 毎日23:59 | ホームの月末清算を自動実行 |
| リマインダー通知 | 動的タスク | リマインダー設定による | FCMプッシュ通知送信 |

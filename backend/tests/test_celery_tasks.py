"""Celery タスクのユニット・統合テスト"""

import zoneinfo
from datetime import date, datetime, time

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cost import AutoSeisan, Cost, Seisan, SeisanMeisai
from app.models.home import Home, HomeLink
from app.models.reminder import Reminder, ReminderContent
from app.models.user import User
from app.tasks.cost_tasks import run_monthly_settlement_async, run_settlement_for_home
from app.tasks.reminder_tasks import _next_notification_date, process_reminder_notifications

_JST = zoneinfo.ZoneInfo("Asia/Tokyo")

_SEQ = 0


def _unique_email() -> str:
    global _SEQ
    _SEQ += 1
    return f"task{_SEQ}@test.com"


async def _make_home_with_members(db: AsyncSession, n: int = 2) -> tuple[int, list[int]]:
    home = Home(name="タスクテストホーム")
    db.add(home)
    await db.flush()
    user_ids = []
    for i in range(n):
        user = User(email=_unique_email(), hashed_password="x", nickname=f"U{i}")
        db.add(user)
        await db.flush()
        db.add(HomeLink(home_id=home.id, user_id=user.id))
        user_ids.append(user.id)
    await db.flush()
    return home.id, user_ids


async def _make_cost(
    db: AsyncSession,
    home_id: int,
    payer_id: int,
    amount: int = 3000,
) -> Cost:
    cost = Cost(
        home_id=home_id,
        payer_user_id=payer_id,
        purchase_date=date(2026, 5, 1),
        amount=amount,
        payment_method="cash",
        memo="",
    )
    db.add(cost)
    await db.flush()
    return cost


# ─── _next_notification_date 単体テスト ────────────────────────────────────────


def test_next_date_none_repeat():
    """repeat=None のとき None を返す"""
    assert _next_notification_date(date(2026, 6, 7), None) is None


def test_next_date_daily():
    """daily: 翌日"""
    assert _next_notification_date(date(2026, 6, 7), "daily") == date(2026, 6, 8)


def test_next_date_weekly():
    """weekly: 7日後"""
    assert _next_notification_date(date(2026, 6, 7), "weekly") == date(2026, 6, 14)


def test_next_date_monthly_normal():
    """monthly: 翌月同日"""
    assert _next_notification_date(date(2026, 6, 7), "monthly") == date(2026, 7, 7)


def test_next_date_monthly_end_of_month():
    """monthly: 翌月に日付が存在しない場合は月末日"""
    # 1月31日 → 2月は28日が上限
    assert _next_notification_date(date(2026, 1, 31), "monthly") == date(2026, 2, 28)


def test_next_date_monthly_year_change():
    """monthly: 12月 → 翌年1月"""
    assert _next_notification_date(date(2026, 12, 15), "monthly") == date(2027, 1, 15)


# ─── run_settlement_for_home 統合テスト ────────────────────────────────────────


async def test_settlement_no_costs_returns_false(db: AsyncSession) -> None:
    """未清算支出がない場合は False を返し Seisan レコードを作成しない"""
    home_id, _ = await _make_home_with_members(db)
    result = await run_settlement_for_home(db, home_id, date(2026, 6, 30))
    assert result is False

    from sqlalchemy import select

    seisans = await db.execute(select(Seisan))
    assert list(seisans.scalars().all()) == []


async def test_settlement_creates_seisan_two_members(db: AsyncSession) -> None:
    """2人・支出あり → Seisan と SeisanMeisai が作成され costs.seisan_id が設定される"""
    home_id, (u1, u2) = await _make_home_with_members(db, n=2)
    cost = await _make_cost(db, home_id, payer_id=u1, amount=2000)

    result = await run_settlement_for_home(db, home_id, date(2026, 6, 30))
    assert result is True

    await db.refresh(cost)
    assert cost.seisan_id is not None

    from sqlalchemy import select

    seisan_result = await db.execute(select(Seisan).where(Seisan.home_id == home_id))
    seisan = seisan_result.scalar_one()
    assert seisan.complete_flag is False
    assert seisan.title == "2026年6月 自動清算"

    meisai_result = await db.execute(
        select(SeisanMeisai).where(SeisanMeisai.seisan_id == seisan.id)
    )
    meisai_list = list(meisai_result.scalars().all())
    assert len(meisai_list) == 1
    assert meisai_list[0].amount == 1000  # 2000円を2人で割り算
    assert meisai_list[0].from_user_id == u2
    assert meisai_list[0].to_user_id == u1


async def test_settlement_creates_seisan_three_members(db: AsyncSession) -> None:
    """3人・複数支出 → 清算が正しく作成される"""
    home_id, (u1, u2, u3) = await _make_home_with_members(db, n=3)
    await _make_cost(db, home_id, payer_id=u1, amount=3000)
    await _make_cost(db, home_id, payer_id=u2, amount=1500)

    result = await run_settlement_for_home(db, home_id, date(2026, 6, 30))
    assert result is True

    from sqlalchemy import select

    seisan_result = await db.execute(select(Seisan).where(Seisan.home_id == home_id))
    seisan = seisan_result.scalar_one()
    meisai_result = await db.execute(
        select(SeisanMeisai).where(SeisanMeisai.seisan_id == seisan.id)
    )
    meisai_list = list(meisai_result.scalars().all())
    # pairwise: u2→u1:500, u3→u1:1000, u3→u2:500 → 計3件、合計2000
    assert len(meisai_list) > 0
    total_transfer = sum(m.amount for m in meisai_list)
    assert total_transfer == 2000


# ─── run_monthly_settlement_async 統合テスト ──────────────────────────────────


async def test_monthly_settlement_skips_when_execute_flag_false(db: AsyncSession) -> None:
    """execute_flag=False のホームは清算しない"""
    home_id, (u1, _) = await _make_home_with_members(db)
    await _make_cost(db, home_id, payer_id=u1)
    db.add(AutoSeisan(home_id=home_id, execute_flag=False, seisan_day=7))
    await db.flush()

    count = await run_monthly_settlement_async(db, today=date(2026, 6, 7))
    assert count == 0


async def test_monthly_settlement_skips_wrong_day(db: AsyncSession) -> None:
    """今日が seisan_day と一致しない場合は清算しない"""
    home_id, (u1, _) = await _make_home_with_members(db)
    await _make_cost(db, home_id, payer_id=u1)
    db.add(AutoSeisan(home_id=home_id, execute_flag=True, seisan_day=15))
    await db.flush()

    count = await run_monthly_settlement_async(db, today=date(2026, 6, 7))
    assert count == 0


async def test_monthly_settlement_runs_on_matching_day(db: AsyncSession) -> None:
    """今日が seisan_day と一致する場合は清算を実行する"""
    home_id, (u1, u2) = await _make_home_with_members(db)
    await _make_cost(db, home_id, payer_id=u1, amount=2000)
    db.add(AutoSeisan(home_id=home_id, execute_flag=True, seisan_day=7))
    await db.flush()

    count = await run_monthly_settlement_async(db, today=date(2026, 6, 7))
    assert count == 1

    from sqlalchemy import select

    seisan_result = await db.execute(select(Seisan).where(Seisan.home_id == home_id))
    assert seisan_result.scalar_one() is not None


async def test_monthly_settlement_overflow_last_day(db: AsyncSession) -> None:
    """seisan_day=31 でも月末日(30日など)に実行される"""
    home_id, (u1, u2) = await _make_home_with_members(db)
    await _make_cost(db, home_id, payer_id=u1, amount=2000)
    db.add(AutoSeisan(home_id=home_id, execute_flag=True, seisan_day=31))
    await db.flush()

    # 6月は30日が月末
    count = await run_monthly_settlement_async(db, today=date(2026, 6, 30))
    assert count == 1


async def test_monthly_settlement_no_auto_seisan_records(db: AsyncSession) -> None:
    """AutoSeisan レコードなし → 清算ゼロ"""
    count = await run_monthly_settlement_async(db, today=date(2026, 6, 7))
    assert count == 0


# ─── process_reminder_notifications 統合テスト ───────────────────────────────


async def _make_reminder_content(
    db: AsyncSession,
    home_id: int,
    notif_date: date,
    notif_time: time,
    repeat: str | None = None,
    is_active: bool = True,
) -> ReminderContent:
    reminder = Reminder(home_id=home_id, list_name="テストリマインダー", complete_flag=False)
    db.add(reminder)
    await db.flush()
    content = ReminderContent(
        reminder_id=reminder.id,
        title="テスト通知",
        memo="メモ",
        date=notif_date,
        time=notif_time,
        repeat=repeat,
        is_active=is_active,
    )
    db.add(content)
    await db.flush()
    return content


async def test_reminder_sends_for_past_due_content(db: AsyncSession) -> None:
    """通知時刻を過ぎたコンテンツは処理される"""
    home_id, _ = await _make_home_with_members(db)
    await _make_reminder_content(
        db,
        home_id,
        notif_date=date(2020, 1, 1),
        notif_time=time(0, 0),
        repeat=None,
    )
    now = datetime(2026, 6, 7, 23, 0, tzinfo=_JST)
    sent = await process_reminder_notifications(db, now=now)
    assert sent == 1


async def test_reminder_skips_future_content(db: AsyncSession) -> None:
    """未来の通知時刻はスキップされる"""
    home_id, _ = await _make_home_with_members(db)
    await _make_reminder_content(
        db,
        home_id,
        notif_date=date(2030, 1, 1),
        notif_time=time(0, 0),
        repeat=None,
    )
    now = datetime(2026, 6, 7, 23, 0, tzinfo=_JST)
    sent = await process_reminder_notifications(db, now=now)
    assert sent == 0


async def test_reminder_deactivates_one_time_after_send(db: AsyncSession) -> None:
    """repeat=None のコンテンツは送信後に is_active=False になる"""
    home_id, _ = await _make_home_with_members(db)
    content = await _make_reminder_content(
        db,
        home_id,
        notif_date=date(2020, 1, 1),
        notif_time=time(0, 0),
        repeat=None,
    )
    now = datetime(2026, 6, 7, 23, 0, tzinfo=_JST)
    await process_reminder_notifications(db, now=now)

    await db.refresh(content)
    assert content.is_active is False


async def test_reminder_advances_date_daily(db: AsyncSession) -> None:
    """repeat=daily のコンテンツは日付が1日進む"""
    home_id, _ = await _make_home_with_members(db)
    content = await _make_reminder_content(
        db,
        home_id,
        notif_date=date(2026, 6, 6),
        notif_time=time(9, 0),
        repeat="daily",
    )
    now = datetime(2026, 6, 7, 10, 0, tzinfo=_JST)
    await process_reminder_notifications(db, now=now)

    await db.refresh(content)
    assert content.date == date(2026, 6, 7)
    assert content.is_active is True


async def test_reminder_advances_date_weekly(db: AsyncSession) -> None:
    """repeat=weekly のコンテンツは日付が7日進む"""
    home_id, _ = await _make_home_with_members(db)
    content = await _make_reminder_content(
        db,
        home_id,
        notif_date=date(2026, 6, 1),
        notif_time=time(9, 0),
        repeat="weekly",
    )
    now = datetime(2026, 6, 7, 10, 0, tzinfo=_JST)
    await process_reminder_notifications(db, now=now)

    await db.refresh(content)
    assert content.date == date(2026, 6, 8)
    assert content.is_active is True


async def test_reminder_advances_date_monthly(db: AsyncSession) -> None:
    """repeat=monthly のコンテンツは翌月同日に進む"""
    home_id, _ = await _make_home_with_members(db)
    content = await _make_reminder_content(
        db,
        home_id,
        notif_date=date(2026, 5, 10),
        notif_time=time(9, 0),
        repeat="monthly",
    )
    now = datetime(2026, 6, 7, 10, 0, tzinfo=_JST)
    await process_reminder_notifications(db, now=now)

    await db.refresh(content)
    assert content.date == date(2026, 6, 10)
    assert content.is_active is True


async def test_reminder_skips_inactive_content(db: AsyncSession) -> None:
    """is_active=False のコンテンツはスキップされる"""
    home_id, _ = await _make_home_with_members(db)
    await _make_reminder_content(
        db,
        home_id,
        notif_date=date(2020, 1, 1),
        notif_time=time(0, 0),
        repeat=None,
        is_active=False,
    )
    now = datetime(2026, 6, 7, 23, 0, tzinfo=_JST)
    sent = await process_reminder_notifications(db, now=now)
    assert sent == 0

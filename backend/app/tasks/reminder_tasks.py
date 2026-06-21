import asyncio
import logging
import zoneinfo
from calendar import monthrange
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.models.reminder import Reminder, ReminderContent
from app.tasks.celery_app import celery_app
from app.utils.fcm import send_push_to_home

logger = logging.getLogger(__name__)

_JST = zoneinfo.ZoneInfo("Asia/Tokyo")


def _next_notification_date(current_date: date, repeat: str | None) -> date | None:
    """繰り返しパターンに応じた次回通知日を返す。None はリピートなし（一回のみ）。"""
    if repeat == "daily":
        return current_date + timedelta(days=1)
    if repeat == "weekly":
        return current_date + timedelta(weeks=1)
    if repeat == "monthly":
        month = current_date.month + 1
        year = current_date.year
        if month > 12:
            month = 1
            year += 1
        last_day = monthrange(year, month)[1]
        return date(year, month, min(current_date.day, last_day))
    return None


async def process_reminder_notifications(
    db: AsyncSession,
    now: datetime | None = None,
) -> int:
    """通知時刻が到来したリマインダーを処理する。

    FCM 通知を送信し、繰り返しパターンに応じて次回通知日を更新する。
    処理した通知数を返す。
    """
    if now is None:
        now = datetime.now(tz=_JST)

    today = now.date()
    now_time = now.timetz().replace(tzinfo=None)

    result = await db.execute(
        select(ReminderContent).where(
            ReminderContent.is_active.is_(True),
            ReminderContent.date.is_not(None),
            ReminderContent.time.is_not(None),
        )
    )
    contents = list(result.scalars().all())

    sent = 0
    for content in contents:
        is_due = content.date < today or (
            content.date == today and content.time <= now_time
        )
        if not is_due:
            continue

        reminder = await db.get(Reminder, content.reminder_id)
        if not reminder:
            continue

        try:
            await send_push_to_home(
                db,
                home_id=reminder.home_id,
                title=content.title,
                body=content.memo or content.title,
            )
            sent += 1
            logger.info(
                "リマインダー通知送信: content_id=%d home_id=%d",
                content.id,
                reminder.home_id,
            )
        except Exception:
            logger.exception("リマインダー通知送信に失敗しました: content_id=%d", content.id)

        next_date = _next_notification_date(content.date, content.repeat)
        if next_date is None:
            content.is_active = False
        else:
            content.date = next_date

        await db.flush()

    return sent


@celery_app.task
def send_reminder_notifications() -> None:
    async def _task() -> None:
        engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
        session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        try:
            async with session_factory() as db:
                try:
                    count = await process_reminder_notifications(db)
                    await db.commit()
                    logger.info("リマインダー通知完了: %d 件を処理", count)
                except Exception:
                    logger.exception("リマインダー通知タスクに失敗しました")
                    await db.rollback()
        finally:
            await engine.dispose()

    asyncio.run(_task())

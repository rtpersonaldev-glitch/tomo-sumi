import datetime as dt
import zoneinfo

from fastapi import HTTPException
from sqlalchemy import asc, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.reminders.schemas import ReminderContentResponse, ReminderResponse
from app.models.reminder import Reminder, ReminderContent
from app.utils.activity_logger import log_activity

_JST = zoneinfo.ZoneInfo("Asia/Tokyo")


def _try_schedule_reminder(
    content_id: int,
    content_date: dt.date | None,
    content_time: dt.time | None,
    is_active: bool,
) -> None:
    """date・time・is_active が揃っていて未来の場合のみ eta タスクをスケジュール。"""
    if not (is_active and content_date and content_time):
        return
    now_jst = dt.datetime.now(tz=_JST)
    target_jst = dt.datetime(
        content_date.year, content_date.month, content_date.day,
        content_time.hour, content_time.minute, content_time.second,
        tzinfo=_JST,
    )
    if target_jst <= now_jst:
        return  # 過去の時刻はポーリング(send_reminder_notifications)が拾う
    try:
        from app.tasks.reminder_tasks import _schedule_single_reminder
        _schedule_single_reminder(content_id, content_date, content_time)
    except Exception:
        pass  # ブローカー未接続(テスト環境等)は無視


class ReminderService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get_reminder_or_403(self, reminder_id: int, home_id: int) -> Reminder:
        reminder = await self.db.get(Reminder, reminder_id)
        if not reminder:
            raise HTTPException(status_code=404, detail="リマインダーが見つかりません")
        if reminder.home_id != home_id:
            raise HTTPException(
                status_code=403, detail="このリマインダーへのアクセス権限がありません"
            )
        return reminder

    async def _get_reminder_with_contents_or_403(
        self, reminder_id: int, home_id: int
    ) -> Reminder:
        result = await self.db.execute(
            select(Reminder)
            .where(Reminder.id == reminder_id)
            .options(selectinload(Reminder.contents))
        )
        reminder = result.scalar_one_or_none()
        if not reminder:
            raise HTTPException(status_code=404, detail="リマインダーが見つかりません")
        if reminder.home_id != home_id:
            raise HTTPException(
                status_code=403, detail="このリマインダーへのアクセス権限がありません"
            )
        return reminder

    async def _get_content_or_403(self, content_id: int, home_id: int) -> ReminderContent:
        content = await self.db.get(ReminderContent, content_id)
        if not content:
            raise HTTPException(status_code=404, detail="リマインダー内容が見つかりません")
        reminder = await self.db.get(Reminder, content.reminder_id)
        if not reminder or reminder.home_id != home_id:
            raise HTTPException(
                status_code=403, detail="このリマインダー内容へのアクセス権限がありません"
            )
        return content

    async def list_reminders(
        self, home_id: int, current_home_id: int
    ) -> list[ReminderResponse]:
        if home_id != current_home_id:
            raise HTTPException(status_code=403, detail="現在選択中のホームのみ参照できます")
        result = await self.db.execute(
            select(Reminder)
            .where(Reminder.home_id == home_id)
            .options(selectinload(Reminder.contents))
            .order_by(asc(Reminder.created_at))
        )
        return [ReminderResponse.model_validate(r) for r in result.scalars().all()]

    async def create_reminder(
        self,
        home_id: int,
        user_id: int,
        list_name: str,
        complete_flag: bool,
    ) -> ReminderResponse:
        reminder = Reminder(
            home_id=home_id,
            list_name=list_name,
            complete_flag=complete_flag,
            created_by=user_id,
        )
        self.db.add(reminder)
        await self.db.flush()
        await log_activity(
            self.db, home_id, user_id, "リマインダーを作成しました", "reminder", reminder.id
        )
        result = await self.db.execute(
            select(Reminder)
            .where(Reminder.id == reminder.id)
            .options(selectinload(Reminder.contents))
        )
        return ReminderResponse.model_validate(result.scalar_one())

    async def get_reminder(self, reminder_id: int, home_id: int) -> ReminderResponse:
        return ReminderResponse.model_validate(
            await self._get_reminder_with_contents_or_403(reminder_id, home_id)
        )

    async def update_reminder(
        self,
        reminder_id: int,
        home_id: int,
        user_id: int,
        list_name: str,
        complete_flag: bool,
    ) -> ReminderResponse:
        reminder = await self._get_reminder_with_contents_or_403(reminder_id, home_id)
        reminder.list_name = list_name
        reminder.complete_flag = complete_flag
        reminder.updated_by = user_id
        await self.db.flush()
        await log_activity(
            self.db, home_id, user_id, "リマインダーを更新しました", "reminder", reminder_id
        )
        return ReminderResponse.model_validate(reminder)

    async def delete_reminder(
        self, reminder_id: int, home_id: int, user_id: int
    ) -> None:
        await self._get_reminder_or_403(reminder_id, home_id)
        result = await self.db.execute(
            select(ReminderContent).where(ReminderContent.reminder_id == reminder_id)
        )
        for content in result.scalars().all():
            await self.db.delete(content)
        await self.db.flush()
        reminder = await self.db.get(Reminder, reminder_id)
        await self.db.delete(reminder)
        await log_activity(
            self.db, home_id, user_id, "リマインダーを削除しました", "reminder", reminder_id
        )
        await self.db.flush()

    async def list_contents(
        self, reminder_id: int, home_id: int
    ) -> list[ReminderContentResponse]:
        await self._get_reminder_or_403(reminder_id, home_id)
        result = await self.db.execute(
            select(ReminderContent)
            .where(ReminderContent.reminder_id == reminder_id)
            .order_by(asc(ReminderContent.created_at))
        )
        return [ReminderContentResponse.model_validate(c) for c in result.scalars().all()]

    async def create_content(
        self,
        reminder_id: int,
        home_id: int,
        user_id: int,
        title: str,
        memo: str,
        content_date: dt.date | None,
        content_time: dt.time | None,
        repeat: str | None,
        is_active: bool = True,
    ) -> ReminderContentResponse:
        await self._get_reminder_or_403(reminder_id, home_id)
        content = ReminderContent(
            reminder_id=reminder_id,
            title=title,
            memo=memo,
            date=content_date,
            time=content_time,
            repeat=repeat,
            is_active=is_active,
            created_by=user_id,
        )
        self.db.add(content)
        await self.db.flush()
        await log_activity(
            self.db,
            home_id,
            user_id,
            "リマインダー内容を追加しました",
            "reminder_content",
            content.id,
        )
        _try_schedule_reminder(content.id, content_date, content_time, is_active)
        return ReminderContentResponse.model_validate(content)

    async def get_content(
        self, content_id: int, home_id: int
    ) -> ReminderContentResponse:
        return ReminderContentResponse.model_validate(
            await self._get_content_or_403(content_id, home_id)
        )

    async def update_content(
        self,
        content_id: int,
        home_id: int,
        user_id: int,
        title: str,
        memo: str,
        content_date: dt.date | None,
        content_time: dt.time | None,
        repeat: str | None,
        is_active: bool,
    ) -> ReminderContentResponse:
        content = await self._get_content_or_403(content_id, home_id)
        if content.created_by is not None and content.created_by != user_id:
            raise HTTPException(
                status_code=403, detail="他のユーザーが作成した内容は編集できません"
            )
        content.title = title
        content.memo = memo
        content.date = content_date
        content.time = content_time
        content.repeat = repeat
        content.is_active = is_active
        content.updated_by = user_id
        await self.db.flush()
        await log_activity(
            self.db,
            home_id,
            user_id,
            "リマインダー内容を更新しました",
            "reminder_content",
            content_id,
        )
        _try_schedule_reminder(content.id, content.date, content.time, content.is_active)
        return ReminderContentResponse.model_validate(content)

    async def toggle_content(
        self, content_id: int, home_id: int, user_id: int
    ) -> ReminderContentResponse:
        content = await self._get_content_or_403(content_id, home_id)
        content.is_active = not content.is_active
        content.updated_by = user_id
        await self.db.flush()
        # True に戻した場合のみ再スケジュール
        if content.is_active:
            _try_schedule_reminder(content.id, content.date, content.time, True)
        return ReminderContentResponse.model_validate(content)

    async def delete_content(
        self, content_id: int, home_id: int, user_id: int
    ) -> None:
        content = await self._get_content_or_403(content_id, home_id)
        if content.created_by is not None and content.created_by != user_id:
            raise HTTPException(
                status_code=403, detail="他のユーザーが作成した内容は削除できません"
            )
        reminder_id = content.reminder_id
        await self.db.delete(content)
        await log_activity(
            self.db,
            home_id,
            user_id,
            "リマインダー内容を削除しました",
            "reminder_content",
            content_id,
        )
        await self.db.flush()
        reminder = await self._get_reminder_with_contents_or_403(reminder_id, home_id)
        all_active = len(reminder.contents) > 0 and all(c.is_active for c in reminder.contents)
        reminder.complete_flag = all_active

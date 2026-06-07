from datetime import UTC, date, datetime

from fastapi import HTTPException
from sqlalchemy import asc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.schedule.schemas import ScheduleResponse
from app.models.schedule import Schedule
from app.utils.activity_logger import log_activity


class ScheduleService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get_or_403(self, schedule_id: int, home_id: int) -> Schedule:
        schedule = await self.db.get(Schedule, schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="スケジュールが見つかりません")
        if schedule.home_id != home_id:
            raise HTTPException(
                status_code=403, detail="このスケジュールへのアクセス権限がありません"
            )
        return schedule

    async def list_schedules(
        self,
        home_id: int,
        current_home_id: int,
        start: date | None = None,
        end: date | None = None,
    ) -> list[ScheduleResponse]:
        if home_id != current_home_id:
            raise HTTPException(status_code=403, detail="現在選択中のホームのみ参照できます")
        query = (
            select(Schedule)
            .where(Schedule.home_id == home_id)
            .order_by(asc(Schedule.start_day))
        )
        if start:
            start_dt = datetime(start.year, start.month, start.day, tzinfo=UTC)
            query = query.where(Schedule.end_day >= start_dt)
        if end:
            end_dt = datetime(end.year, end.month, end.day, 23, 59, 59, tzinfo=UTC)
            query = query.where(Schedule.start_day <= end_dt)
        result = await self.db.execute(query)
        schedules = list(result.scalars().all())
        return [ScheduleResponse.model_validate(s) for s in schedules]

    async def create_schedule(
        self,
        home_id: int,
        user_id: int,
        title: str,
        memo: str,
        start_day: datetime,
        end_day: datetime,
    ) -> ScheduleResponse:
        schedule = Schedule(
            home_id=home_id,
            title=title,
            memo=memo,
            start_day=start_day,
            end_day=end_day,
            created_by=user_id,
        )
        self.db.add(schedule)
        await self.db.flush()
        await log_activity(
            self.db, home_id, user_id, "スケジュールを作成しました", "schedule", schedule.id
        )
        return ScheduleResponse.model_validate(schedule)

    async def get_schedule(self, schedule_id: int, home_id: int) -> ScheduleResponse:
        schedule = await self._get_or_403(schedule_id, home_id)
        return ScheduleResponse.model_validate(schedule)

    async def update_schedule(
        self,
        schedule_id: int,
        home_id: int,
        user_id: int,
        title: str,
        memo: str,
        start_day: datetime,
        end_day: datetime,
    ) -> ScheduleResponse:
        schedule = await self._get_or_403(schedule_id, home_id)
        schedule.title = title
        schedule.memo = memo
        schedule.start_day = start_day
        schedule.end_day = end_day
        schedule.updated_by = user_id
        await self.db.flush()
        await log_activity(
            self.db, home_id, user_id, "スケジュールを更新しました", "schedule", schedule_id
        )
        return ScheduleResponse.model_validate(schedule)

    async def delete_schedule(self, schedule_id: int, home_id: int, user_id: int) -> None:
        schedule = await self._get_or_403(schedule_id, home_id)
        await self.db.delete(schedule)
        await log_activity(
            self.db, home_id, user_id, "スケジュールを削除しました", "schedule", schedule_id
        )
        await self.db.flush()

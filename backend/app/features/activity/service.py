from datetime import UTC, datetime

from sqlalchemy import exists, func, not_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.activity.schemas import ActivityLogResponse
from app.models.activity import ActivityLog, ActivityReadStatus
from app.models.user import User


class ActivityService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_logs(self, home_id: int) -> list[ActivityLogResponse]:
        result = await self.db.execute(
            select(ActivityLog, User.nickname)
            .outerjoin(User, User.id == ActivityLog.user_id)
            .where(ActivityLog.home_id == home_id)
            .order_by(ActivityLog.created_at.desc())
            .limit(50)
        )
        return [
            ActivityLogResponse(
                id=log.id,
                action=log.action,
                target_model=log.target_model,
                target_id=log.target_id,
                user_id=log.user_id,
                nickname=nickname,
                created_at=log.created_at,
            )
            for log, nickname in result.all()
        ]

    async def get_unread_count(self, home_id: int, user_id: int) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(ActivityLog)
            .where(
                ActivityLog.home_id == home_id,
                not_(
                    exists().where(
                        ActivityReadStatus.activity_id == ActivityLog.id,
                        ActivityReadStatus.user_id == user_id,
                    )
                ),
            )
        )
        return result.scalar_one()

    async def mark_as_read(self, home_id: int, user_id: int) -> None:
        unread_result = await self.db.execute(
            select(ActivityLog.id).where(
                ActivityLog.home_id == home_id,
                not_(
                    exists().where(
                        ActivityReadStatus.activity_id == ActivityLog.id,
                        ActivityReadStatus.user_id == user_id,
                    )
                ),
            )
        )
        unread_ids = list(unread_result.scalars().all())
        now = datetime.now(tz=UTC)
        for activity_id in unread_ids:
            self.db.add(
                ActivityReadStatus(
                    user_id=user_id,
                    activity_id=activity_id,
                    read_at=now,
                )
            )
        if unread_ids:
            await self.db.flush()

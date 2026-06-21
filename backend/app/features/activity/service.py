from datetime import UTC, datetime

from sqlalchemy import exists, func, not_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.features.activity.schemas import ActivityLogResponse
from app.models.activity import ActivityLog, ActivityReadStatus
from app.models.user import User
from app.utils.file_storage import get_media_url


class ActivityService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_logs(self, home_id: int, user_id: int) -> list[ActivityLogResponse]:
        result = await self.db.execute(
            select(
                ActivityLog,
                User.nickname,
                User.icon_path,
                ActivityReadStatus.id,
            )
            .outerjoin(User, User.id == ActivityLog.user_id)
            .outerjoin(
                ActivityReadStatus,
                (ActivityReadStatus.activity_id == ActivityLog.id)
                & (ActivityReadStatus.user_id == user_id),
            )
            .where(
                ActivityLog.home_id == home_id,
                or_(ActivityLog.user_id != user_id, ActivityLog.user_id.is_(None)),
            )
            .order_by(ActivityLog.created_at.desc())
            .limit(50)
        )
        return [
            ActivityLogResponse(
                id=log.id,
                action=log.action,
                target_type=log.target_model,
                target_id=log.target_id,
                user_id=log.user_id,
                nickname=nickname,
                icon_url=get_media_url(icon_path, settings.MEDIA_BASE_URL),
                is_read=read_id is not None,
                created_at=log.created_at,
            )
            for log, nickname, icon_path, read_id in result.all()
        ]

    async def get_unread_count(self, home_id: int, user_id: int) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(ActivityLog)
            .where(
                ActivityLog.home_id == home_id,
                or_(ActivityLog.user_id != user_id, ActivityLog.user_id.is_(None)),
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
                or_(ActivityLog.user_id != user_id, ActivityLog.user_id.is_(None)),
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

    async def mark_single_as_read(self, activity_id: int, home_id: int, user_id: int) -> None:
        log_result = await self.db.execute(
            select(ActivityLog.id).where(
                ActivityLog.id == activity_id,
                ActivityLog.home_id == home_id,
            )
        )
        if log_result.scalar_one_or_none() is None:
            return

        already_read = await self.db.execute(
            select(ActivityReadStatus.id).where(
                ActivityReadStatus.activity_id == activity_id,
                ActivityReadStatus.user_id == user_id,
            )
        )
        if already_read.scalar_one_or_none() is not None:
            return

        self.db.add(
            ActivityReadStatus(
                user_id=user_id,
                activity_id=activity_id,
                read_at=datetime.now(tz=UTC),
            )
        )
        await self.db.flush()

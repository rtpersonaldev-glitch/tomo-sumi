from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityLog


async def log_activity(
    db: AsyncSession,
    home_id: int,
    user_id: int | None,
    action: str,
    target_type: str,
    target_id: int | None = None,
) -> None:
    db.add(
        ActivityLog(
            home_id=home_id,
            user_id=user_id,
            action=action,
            target_model=target_type,
            target_id=target_id,
        )
    )
    await db.flush()

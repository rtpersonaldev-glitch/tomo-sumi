from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_home, get_current_user
from app.features.activity.schemas import ActivityLogResponse, UnreadCountResponse
from app.features.activity.service import ActivityService
from app.models.home import Home
from app.models.user import User

router = APIRouter()


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    current_home: Home = Depends(get_current_home),
    db: AsyncSession = Depends(get_db),
) -> UnreadCountResponse:
    count = await ActivityService(db).get_unread_count(current_home.id, current_user.id)
    return UnreadCountResponse(unread_count=count)


@router.post("/mark-as-read", status_code=204)
async def mark_as_read(
    current_user: User = Depends(get_current_user),
    current_home: Home = Depends(get_current_home),
    db: AsyncSession = Depends(get_db),
) -> None:
    await ActivityService(db).mark_as_read(current_home.id, current_user.id)


@router.get("/{home_id}", response_model=list[ActivityLogResponse])
async def get_activity_logs(
    home_id: int,
    current_home: Home = Depends(get_current_home),
    db: AsyncSession = Depends(get_db),
) -> list[ActivityLogResponse]:
    if current_home.id != home_id:
        raise HTTPException(
            status_code=403, detail="現在選択中のホームのアクティビティのみ取得できます"
        )
    return await ActivityService(db).get_logs(home_id)

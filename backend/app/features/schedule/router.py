from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_home, get_current_user
from app.features.schedule.schemas import (
    ScheduleCreateRequest,
    ScheduleResponse,
    ScheduleUpdateRequest,
)
from app.features.schedule.service import ScheduleService
from app.models.home import Home
from app.models.user import User

router = APIRouter()


@router.post("", response_model=ScheduleResponse, status_code=201)
async def create_schedule(
    body: ScheduleCreateRequest,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScheduleResponse:
    return await ScheduleService(db).create_schedule(
        home_id=current_home.id,
        user_id=current_user.id,
        title=body.title,
        memo=body.memo,
        start_day=body.start_day,
        end_day=body.end_day,
    )


@router.get("/{home_id}", response_model=list[ScheduleResponse])
async def list_schedules(
    home_id: int,
    start: date | None = None,
    end: date | None = None,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ScheduleResponse]:
    return await ScheduleService(db).list_schedules(
        home_id=home_id,
        current_home_id=current_home.id,
        start=start,
        end=end,
    )


@router.get("/{schedule_id}/detail", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScheduleResponse:
    return await ScheduleService(db).get_schedule(
        schedule_id=schedule_id,
        home_id=current_home.id,
    )


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: int,
    body: ScheduleUpdateRequest,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScheduleResponse:
    return await ScheduleService(db).update_schedule(
        schedule_id=schedule_id,
        home_id=current_home.id,
        user_id=current_user.id,
        title=body.title,
        memo=body.memo,
        start_day=body.start_day,
        end_day=body.end_day,
    )


@router.delete("/{schedule_id}", status_code=204)
async def delete_schedule(
    schedule_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await ScheduleService(db).delete_schedule(
        schedule_id=schedule_id,
        home_id=current_home.id,
        user_id=current_user.id,
    )

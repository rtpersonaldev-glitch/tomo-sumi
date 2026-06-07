from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_home, get_current_user
from app.features.reminders.schemas import (
    ReminderContentCreateRequest,
    ReminderContentResponse,
    ReminderContentUpdateRequest,
    ReminderCreateRequest,
    ReminderResponse,
    ReminderUpdateRequest,
)
from app.features.reminders.service import ReminderService
from app.models.home import Home
from app.models.user import User

router = APIRouter()


# ── ReminderContent endpoints (registered before /{id} to avoid route conflicts) ─────


@router.get("/contents/{content_id}", response_model=ReminderContentResponse)
async def get_reminder_content(
    content_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReminderContentResponse:
    return await ReminderService(db).get_content(
        content_id=content_id,
        home_id=current_home.id,
    )


@router.put("/contents/{content_id}", response_model=ReminderContentResponse)
async def update_reminder_content(
    content_id: int,
    body: ReminderContentUpdateRequest,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReminderContentResponse:
    return await ReminderService(db).update_content(
        content_id=content_id,
        home_id=current_home.id,
        user_id=current_user.id,
        title=body.title,
        memo=body.memo,
        content_date=body.date,
        content_time=body.time,
        repeat=body.repeat,
        is_active=body.is_active,
    )


@router.post("/contents/{content_id}/toggle", response_model=ReminderContentResponse)
async def toggle_reminder_content(
    content_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReminderContentResponse:
    return await ReminderService(db).toggle_content(
        content_id=content_id,
        home_id=current_home.id,
        user_id=current_user.id,
    )


# ── Reminder (group) endpoints ────────────────────────────────────────────────────────


@router.post("", response_model=ReminderResponse, status_code=201)
async def create_reminder(
    body: ReminderCreateRequest,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReminderResponse:
    return await ReminderService(db).create_reminder(
        home_id=current_home.id,
        user_id=current_user.id,
        list_name=body.list_name,
        complete_flag=body.complete_flag,
    )


@router.get("/{home_id}", response_model=list[ReminderResponse])
async def list_reminders(
    home_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ReminderResponse]:
    return await ReminderService(db).list_reminders(
        home_id=home_id,
        current_home_id=current_home.id,
    )


@router.get("/{reminder_id}/detail", response_model=ReminderResponse)
async def get_reminder(
    reminder_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReminderResponse:
    return await ReminderService(db).get_reminder(
        reminder_id=reminder_id,
        home_id=current_home.id,
    )


@router.put("/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(
    reminder_id: int,
    body: ReminderUpdateRequest,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReminderResponse:
    return await ReminderService(db).update_reminder(
        reminder_id=reminder_id,
        home_id=current_home.id,
        user_id=current_user.id,
        list_name=body.list_name,
        complete_flag=body.complete_flag,
    )


@router.delete("/{reminder_id}", status_code=204)
async def delete_reminder(
    reminder_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await ReminderService(db).delete_reminder(
        reminder_id=reminder_id,
        home_id=current_home.id,
        user_id=current_user.id,
    )


@router.get("/{reminder_id}/contents", response_model=list[ReminderContentResponse])
async def list_reminder_contents(
    reminder_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ReminderContentResponse]:
    return await ReminderService(db).list_contents(
        reminder_id=reminder_id,
        home_id=current_home.id,
    )


@router.post("/{reminder_id}/contents", response_model=ReminderContentResponse, status_code=201)
async def create_reminder_content(
    reminder_id: int,
    body: ReminderContentCreateRequest,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReminderContentResponse:
    return await ReminderService(db).create_content(
        reminder_id=reminder_id,
        home_id=current_home.id,
        user_id=current_user.id,
        title=body.title,
        memo=body.memo,
        content_date=body.date,
        content_time=body.time,
        repeat=body.repeat,
    )

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_home, get_current_user
from app.features.announces.schemas import (
    AnnounceCreateRequest,
    AnnounceLikeResponse,
    AnnounceResponse,
    AnnounceUpdateRequest,
)
from app.features.announces.service import AnnounceService
from app.models.home import Home
from app.models.user import User

router = APIRouter()


@router.post("", response_model=AnnounceResponse, status_code=201)
async def create_announce(
    body: AnnounceCreateRequest,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnnounceResponse:
    return await AnnounceService(db).create_announce(
        home_id=current_home.id,
        user_id=current_user.id,
        title=body.title,
        content=body.content,
        priority=body.priority,
        end_date=body.end_date,
    )


@router.get("/{home_id}", response_model=list[AnnounceResponse])
async def list_announces(
    home_id: int,
    search: str | None = None,
    priority: str | None = None,
    ordering: str | None = None,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AnnounceResponse]:
    return await AnnounceService(db).list_announces(
        home_id=home_id,
        current_home_id=current_home.id,
        user_id=current_user.id,
        search=search,
        priority=priority,
        ordering=ordering,
    )


@router.get("/{announce_id}/detail", response_model=AnnounceResponse)
async def get_announce_detail(
    announce_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnnounceResponse:
    return await AnnounceService(db).get_announce(
        announce_id=announce_id,
        home_id=current_home.id,
        user_id=current_user.id,
    )


@router.put("/{announce_id}", response_model=AnnounceResponse)
async def update_announce(
    announce_id: int,
    body: AnnounceUpdateRequest,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnnounceResponse:
    return await AnnounceService(db).update_announce(
        announce_id=announce_id,
        home_id=current_home.id,
        user_id=current_user.id,
        title=body.title,
        content=body.content,
        priority=body.priority,
        end_date=body.end_date,
    )


@router.delete("/{announce_id}", status_code=204)
async def delete_announce(
    announce_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await AnnounceService(db).delete_announce(
        announce_id=announce_id,
        home_id=current_home.id,
        user_id=current_user.id,
    )


@router.post("/{announce_id}/like", response_model=AnnounceLikeResponse)
async def toggle_like(
    announce_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnnounceLikeResponse:
    return await AnnounceService(db).toggle_like(
        announce_id=announce_id,
        home_id=current_home.id,
        user_id=current_user.id,
    )


@router.post("/{announce_id}/push", status_code=204)
async def send_push(
    announce_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await AnnounceService(db).send_push(
        announce_id=announce_id,
        home_id=current_home.id,
        user_id=current_user.id,
    )

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_home, get_current_user
from app.features.homes.schemas import (
    DashboardResponse,
    DashboardScheduleResponse,
    HomeCreateRequest,
    HomeMemberResponse,
    HomeResponse,
    InvitationCodeResponse,
)
from app.features.homes.service import HomeService
from app.models.home import Home
from app.models.user import User

router = APIRouter()


@router.get("", response_model=list[HomeResponse])
async def list_homes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[HomeResponse]:
    homes = await HomeService(db).list_homes(current_user)
    return [HomeResponse.model_validate(h) for h in homes]


@router.post("", response_model=HomeResponse, status_code=201)
async def create_home(
    body: HomeCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HomeResponse:
    home = await HomeService(db).create_home(current_user, body.name)
    return HomeResponse.model_validate(home)


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardResponse:
    members, schedules, announce_count, announces, has_more = await HomeService(db).get_dashboard(
        current_home.id, current_user.id
    )
    return DashboardResponse(
        members=[HomeMemberResponse.model_validate(m) for m in members],
        today_schedules=[DashboardScheduleResponse.model_validate(s) for s in schedules],
        unread_announce_count=announce_count,
        announces=announces,
        has_more_announces=has_more,
    )


@router.post("/join/{code}", response_model=HomeResponse)
async def join_home(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HomeResponse:
    home = await HomeService(db).join_home(current_user, code)
    return HomeResponse.model_validate(home)


@router.get("/{home_id}", response_model=HomeResponse)
async def get_home(
    home_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HomeResponse:
    home = await HomeService(db).get_home(current_user.id, home_id)
    return HomeResponse.model_validate(home)


@router.put("/{home_id}", response_model=HomeResponse)
async def update_home(
    home_id: int,
    name: str = Form(...),
    home_image: UploadFile | None = File(None),
    current_home: Home = Depends(get_current_home),
    db: AsyncSession = Depends(get_db),
) -> HomeResponse:
    if current_home.id != home_id:
        raise HTTPException(status_code=403, detail="現在選択中のホームのみ更新できます")
    home = await HomeService(db).update_home(current_home, name, home_image)
    return HomeResponse.model_validate(home)


@router.get("/{home_id}/users", response_model=list[HomeMemberResponse])
async def get_home_members(
    home_id: int,
    current_home: Home = Depends(get_current_home),
    db: AsyncSession = Depends(get_db),
) -> list[HomeMemberResponse]:
    if current_home.id != home_id:
        raise HTTPException(
            status_code=403, detail="現在選択中のホームのメンバーのみ取得できます"
        )
    members = await HomeService(db).get_members(home_id)
    return [HomeMemberResponse.model_validate(m) for m in members]


@router.get("/{home_id}/invitation-code", response_model=InvitationCodeResponse)
async def get_invitation_code(
    home_id: int,
    current_home: Home = Depends(get_current_home),
    db: AsyncSession = Depends(get_db),
) -> InvitationCodeResponse:
    if current_home.id != home_id:
        raise HTTPException(
            status_code=403, detail="現在選択中のホームの招待コードのみ生成できます"
        )
    invitation = await HomeService(db).get_invitation_code(home_id)
    return InvitationCodeResponse(code=invitation.code, expires_at=invitation.expires_at)

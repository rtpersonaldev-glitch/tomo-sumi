from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import create_access_token, create_refresh_token, verify_token
from app.features.auth.schemas import (
    FCMTokenRequest,
    HomeResponse,
    LoginRequest,
    MeResponse,
    ProfileUpdateRequest,
    RegisterRequest,
    SettingsResponse,
    UserResponse,
)
from app.features.auth.service import AuthService
from app.models.home import Home
from app.models.user import User

router = APIRouter()

_SECURE = not settings.DEBUG


def set_auth_cookies(response: Response, user_id: int, home_id: int | None = None) -> None:
    access_token = create_access_token(user_id, home_id)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=_SECURE,
        samesite="lax",
        max_age=60 * settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=_SECURE,
        samesite="strict",
        max_age=60 * 60 * 24 * settings.REFRESH_TOKEN_EXPIRE_DAYS,
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> User:
    return await AuthService(db).register(body)


@router.post("/login")
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await AuthService(db).authenticate(body.email, body.password)
    set_auth_cookies(response, user.id, user.selected_home_id)
    return {"message": "Login successful"}


@router.get("/me", response_model=MeResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MeResponse:
    service = AuthService(db)
    homes = await service.get_user_homes(current_user)
    home = None
    if current_user.selected_home_id:
        home = await db.get(Home, current_user.selected_home_id)
    return MeResponse(
        user=UserResponse.model_validate(current_user),
        homes=[HomeResponse.model_validate(h) for h in homes],
        home=HomeResponse.model_validate(home) if home else None,
    )


@router.post("/refresh")
async def refresh_token(
    response: Response,
    refresh_token: str | None = Cookie(None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    payload = verify_token(refresh_token, token_type="refresh")
    user = await db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")
    set_auth_cookies(response, user.id, user.selected_home_id)
    return {"message": "Token refreshed"}


@router.post("/logout")
async def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
) -> dict:
    clear_auth_cookies(response)
    return {"message": "Logged out"}


@router.post("/home-login/{home_id}")
async def home_login(
    home_id: int,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    service = AuthService(db)
    home = await service.select_home(current_user, home_id)
    current_user.selected_home_id = home.id
    await db.flush()
    set_auth_cookies(response, current_user.id, home.id)
    return {"message": "Home selected"}


@router.post("/home-logout")
async def home_logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    current_user.selected_home_id = None
    await db.flush()
    set_auth_cookies(response, current_user.id, None)
    return {"message": "Home deselected"}


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    body: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    current_user.nickname = body.nickname
    await db.flush()
    return current_user


@router.post("/status/toggle", response_model=UserResponse)
async def toggle_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    current_user.status = "away" if current_user.status == "at_home" else "at_home"
    await db.flush()
    return current_user


@router.get("/settings", response_model=SettingsResponse)
async def get_settings(current_user: User = Depends(get_current_user)) -> SettingsResponse:
    return SettingsResponse(notification_flag=current_user.notification_flag)


@router.post("/notification/toggle", response_model=SettingsResponse)
async def toggle_notification(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SettingsResponse:
    current_user.notification_flag = not current_user.notification_flag
    await db.flush()
    return SettingsResponse(notification_flag=current_user.notification_flag)


@router.post("/fcm-token", status_code=204)
async def register_fcm_token(
    body: FCMTokenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await AuthService(db).register_fcm_token(current_user.id, body.token)

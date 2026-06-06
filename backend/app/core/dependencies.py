from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import verify_token
from app.models.home import Home
from app.models.user import User


async def get_current_user(
    access_token: str | None = Cookie(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """ユーザーログイン必須"""
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(access_token)
    user = await db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_current_home(
    access_token: str | None = Cookie(None),
    db: AsyncSession = Depends(get_db),
) -> Home:
    """ホーム選択必須（JWTのhome_idを使用）"""
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(access_token)
    home_id = payload.get("home_id")
    if not home_id:
        raise HTTPException(status_code=403, detail="No home selected")
    home = await db.get(Home, home_id)
    if not home:
        raise HTTPException(status_code=404, detail="Home not found")
    return home

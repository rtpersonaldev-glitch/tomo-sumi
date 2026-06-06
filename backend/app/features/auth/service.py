from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.features.auth.schemas import RegisterRequest
from app.models.home import Home, HomeLink
from app.models.user import FCMToken, User
from app.utils.file_storage import delete_image, save_image


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def register(self, data: RegisterRequest) -> User:
        result = await self.db.execute(select(User).where(User.email == data.email))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="このメールアドレスは既に登録されています")
        user = User(
            email=data.email,
            hashed_password=hash_password(data.password),
            nickname=data.nickname,
        )
        self.db.add(user)
        await self.db.flush()
        return user

    async def authenticate(self, email: str, password: str) -> User:
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=401, detail="メールアドレスまたはパスワードが正しくありません"
            )
        if not user.is_active:
            raise HTTPException(status_code=401, detail="アカウントが無効です")
        return user

    async def select_home(self, user: User, home_id: int) -> Home:
        result = await self.db.execute(
            select(HomeLink).where(
                HomeLink.user_id == user.id,
                HomeLink.home_id == home_id,
                HomeLink.deleted_at.is_(None),
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="このホームへのアクセス権限がありません")
        home = await self.db.get(Home, home_id)
        if not home:
            raise HTTPException(status_code=404, detail="ホームが見つかりません")
        return home

    async def get_user_homes(self, user: User) -> list[Home]:
        result = await self.db.execute(
            select(Home)
            .join(HomeLink, HomeLink.home_id == Home.id)
            .where(HomeLink.user_id == user.id, HomeLink.deleted_at.is_(None))
        )
        return list(result.scalars().all())

    async def update_profile(
        self, user: User, nickname: str, icon: UploadFile | None
    ) -> User:
        user.nickname = nickname
        if icon:
            delete_image(user.icon_path)
            user.icon_path = await save_image(icon, directory="icons", max_mb=5)
        await self.db.flush()
        return user

    async def register_fcm_token(self, user_id: int, token: str) -> None:
        result = await self.db.execute(select(FCMToken).where(FCMToken.token == token))
        if result.scalar_one_or_none():
            return
        self.db.add(FCMToken(user_id=user_id, token=token))
        await self.db.flush()

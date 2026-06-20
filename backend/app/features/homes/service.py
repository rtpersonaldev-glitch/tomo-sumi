import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, UploadFile
from sqlalchemy import asc, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.features.announces.schemas import AnnounceResponse as AnnounceSchemaResponse
from app.features.announces.service import AnnounceService
from app.models.announce import Announce, AnnounceRecipient
from app.models.home import Home, HomeLink, InvitationCode
from app.models.schedule import Schedule
from app.models.user import User
from app.utils.file_storage import delete_image, save_image


class HomeService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_homes(self, user: User) -> list[Home]:
        result = await self.db.execute(
            select(Home)
            .join(HomeLink, HomeLink.home_id == Home.id)
            .where(HomeLink.user_id == user.id, HomeLink.deleted_at.is_(None))
        )
        return list(result.scalars().all())

    async def create_home(self, user: User, name: str) -> Home:
        home = Home(name=name)
        self.db.add(home)
        await self.db.flush()
        self.db.add(HomeLink(user_id=user.id, home_id=home.id))
        await self.db.flush()
        return home

    async def get_home(self, user_id: int, home_id: int) -> Home:
        link_result = await self.db.execute(
            select(HomeLink).where(
                HomeLink.user_id == user_id,
                HomeLink.home_id == home_id,
                HomeLink.deleted_at.is_(None),
            )
        )
        if not link_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="このホームへのアクセス権限がありません")
        home = await self.db.get(Home, home_id)
        if not home:
            raise HTTPException(status_code=404, detail="ホームが見つかりません")
        return home

    async def update_home(
        self, home: Home, name: str, home_image: UploadFile | None
    ) -> Home:
        home.name = name
        if home_image:
            old_path = home.home_image_path
            home.home_image_path = await save_image(
                home_image, directory="home_images", max_mb=5
            )
            delete_image(old_path)
        await self.db.flush()
        return home

    async def get_members(self, home_id: int) -> list[User]:
        result = await self.db.execute(
            select(User)
            .join(HomeLink, HomeLink.user_id == User.id)
            .where(HomeLink.home_id == home_id, HomeLink.deleted_at.is_(None))
        )
        return list(result.scalars().all())

    async def get_invitation_code(self, home_id: int) -> InvitationCode:
        code = secrets.token_urlsafe(8)
        expires_at = datetime.now(tz=UTC) + timedelta(hours=24)
        invitation = InvitationCode(home_id=home_id, code=code, expires_at=expires_at)
        self.db.add(invitation)
        await self.db.flush()
        return invitation

    async def join_home(self, user: User, code: str) -> Home:
        result = await self.db.execute(
            select(InvitationCode).where(InvitationCode.code == code)
        )
        invitation = result.scalar_one_or_none()
        if not invitation:
            raise HTTPException(status_code=404, detail="招待コードが見つかりません")
        if invitation.used:
            raise HTTPException(status_code=400, detail="この招待コードは既に使用されています")
        if invitation.expires_at < datetime.now(tz=UTC):
            raise HTTPException(status_code=400, detail="この招待コードは期限切れです")

        existing = await self.db.execute(
            select(HomeLink).where(
                HomeLink.user_id == user.id,
                HomeLink.home_id == invitation.home_id,
                HomeLink.deleted_at.is_(None),
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="既にこのホームのメンバーです")

        self.db.add(HomeLink(user_id=user.id, home_id=invitation.home_id))
        invitation.used = True
        await self.db.flush()

        home = await self.db.get(Home, invitation.home_id)
        if not home:
            raise HTTPException(status_code=404, detail="ホームが見つかりません")
        return home

    async def get_dashboard(
        self, home_id: int, user_id: int
    ) -> tuple[list[User], list[Schedule], int, list[AnnounceSchemaResponse], bool]:
        members_result = await self.db.execute(
            select(User)
            .join(HomeLink, HomeLink.user_id == User.id)
            .where(HomeLink.home_id == home_id, HomeLink.deleted_at.is_(None))
        )
        members = list(members_result.scalars().all())

        now = datetime.now(tz=UTC)
        today_start = datetime(now.year, now.month, now.day, tzinfo=UTC)
        today_end = today_start + timedelta(days=1)
        schedules_result = await self.db.execute(
            select(Schedule)
            .where(
                Schedule.home_id == home_id,
                Schedule.start_day >= today_start,
                Schedule.start_day < today_end,
            )
            .order_by(Schedule.start_day)
            .limit(10)
        )
        schedules = list(schedules_result.scalars().all())

        count_result = await self.db.execute(
            select(func.count())
            .select_from(Announce)
            .where(
                Announce.home_id == home_id,
                Announce.end_date >= now.date(),
            )
        )
        announce_count = count_result.scalar_one()

        priority_order = case(
            (Announce.priority == "high", 1),
            (Announce.priority == "medium", 2),
            else_=3,
        )
        has_recipient = (
            select(AnnounceRecipient.announce_id)
            .where(AnnounceRecipient.announce_id == Announce.id)
            .exists()
        )
        user_is_recipient = (
            select(AnnounceRecipient.announce_id)
            .where(
                AnnounceRecipient.announce_id == Announce.id,
                AnnounceRecipient.user_id == user_id,
            )
            .exists()
        )
        announces_result = await self.db.execute(
            select(Announce)
            .options(
                joinedload(Announce.likes),
                joinedload(Announce.recipients),
                joinedload(Announce.creator),
            )
            .where(
                Announce.home_id == home_id,
                Announce.end_date >= now.date(),
                or_(~has_recipient, user_is_recipient),
            )
            .order_by(priority_order, asc(Announce.end_date))
            .limit(6)
        )
        raw_announces = list(announces_result.scalars().unique().all())
        has_more_announces = len(raw_announces) > 5
        announce_service = AnnounceService(self.db)
        announces = [
            announce_service._to_response(a, user_id) for a in raw_announces[:5]
        ]

        return members, schedules, announce_count, announces, has_more_announces

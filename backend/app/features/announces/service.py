from datetime import date

from fastapi import HTTPException
from sqlalchemy import asc, delete, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.features.announces.schemas import AnnounceLikeResponse, AnnounceResponse, AnnounceUserInfo
from app.models.announce import Announce, AnnounceLike, AnnounceRecipient
from app.utils.activity_logger import log_activity
from app.utils.fcm import send_push_to_home
from app.utils.file_storage import get_media_url


class AnnounceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get_or_403(self, announce_id: int, home_id: int) -> Announce:
        result = await self.db.execute(
            select(Announce)
            .options(
                joinedload(Announce.likes),
                joinedload(Announce.recipients),
                joinedload(Announce.creator),
            )
            .where(Announce.id == announce_id)
        )
        announce = result.scalars().unique().one_or_none()
        if not announce:
            raise HTTPException(status_code=404, detail="お知らせが見つかりません")
        if announce.home_id != home_id:
            raise HTTPException(status_code=403, detail="このお知らせへのアクセス権限がありません")
        return announce

    def _can_view(self, announce: Announce, user_id: int) -> bool:
        """宛先なし（全員）or 自分が宛先に含まれる場合のみ True"""
        if not announce.recipients:
            return True
        return any(r.user_id == user_id for r in announce.recipients)

    def _to_response(self, announce: Announce, user_id: int) -> AnnounceResponse:
        creator = announce.creator
        created_by_user = (
            AnnounceUserInfo(
                id=creator.id,
                nickname=creator.nickname,
                icon_url=get_media_url(creator.icon_path, settings.MEDIA_BASE_URL),
            )
            if creator
            else None
        )
        return AnnounceResponse(
            id=announce.id,
            home_id=announce.home_id,
            title=announce.title,
            content=announce.content,
            priority=announce.priority,
            end_date=announce.end_date,
            like_count=len(announce.likes),
            is_liked=any(like.user_id == user_id for like in announce.likes),
            recipient_ids=[r.user_id for r in announce.recipients],
            created_at=announce.created_at,
            created_by_user=created_by_user,
        )

    async def list_announces(
        self,
        home_id: int,
        current_home_id: int,
        user_id: int,
        search: str | None = None,
        priority: str | None = None,
        ordering: str | None = None,
    ) -> list[AnnounceResponse]:
        if home_id != current_home_id:
            raise HTTPException(status_code=403, detail="現在選択中のホームのみ参照できます")
        query = (
            select(Announce)
            .options(
                joinedload(Announce.likes),
                joinedload(Announce.recipients),
                joinedload(Announce.creator),
            )
            .where(Announce.home_id == home_id)
        )
        if search:
            query = query.where(
                or_(
                    Announce.title.ilike(f"%{search}%"),
                    Announce.content.ilike(f"%{search}%"),
                )
            )
        if priority:
            query = query.where(Announce.priority == priority)

        if ordering == "end_date":
            query = query.order_by(asc(Announce.end_date))
        elif ordering == "-end_date":
            query = query.order_by(desc(Announce.end_date))
        elif ordering == "created_at":
            query = query.order_by(asc(Announce.created_at))
        else:
            query = query.order_by(desc(Announce.created_at))

        result = await self.db.execute(query)
        announces = list(result.scalars().unique().all())
        return [
            self._to_response(a, user_id)
            for a in announces
            if self._can_view(a, user_id)
        ]

    async def create_announce(
        self,
        home_id: int,
        user_id: int,
        title: str,
        content: str,
        priority: str,
        end_date: date,
        recipient_ids: list[int],
    ) -> AnnounceResponse:
        announce = Announce(
            home_id=home_id,
            title=title,
            content=content,
            priority=priority,
            end_date=end_date,
            created_by=user_id,
        )
        self.db.add(announce)
        await self.db.flush()

        for uid in recipient_ids:
            self.db.add(AnnounceRecipient(announce_id=announce.id, user_id=uid))
        await self.db.flush()

        result = await self.db.execute(
            select(Announce)
            .options(
                joinedload(Announce.likes),
                joinedload(Announce.recipients),
                joinedload(Announce.creator),
            )
            .where(Announce.id == announce.id)
        )
        announce = result.scalars().unique().one()
        await log_activity(
            self.db, home_id, user_id, "お知らせを作成しました", "announce", announce.id
        )
        return self._to_response(announce, user_id)

    async def get_announce(
        self, announce_id: int, home_id: int, user_id: int
    ) -> AnnounceResponse:
        announce = await self._get_or_403(announce_id, home_id)
        if not self._can_view(announce, user_id):
            raise HTTPException(status_code=403, detail="このお知らせへのアクセス権限がありません")
        return self._to_response(announce, user_id)

    async def update_announce(
        self,
        announce_id: int,
        home_id: int,
        user_id: int,
        title: str,
        content: str,
        priority: str,
        end_date: date,
        recipient_ids: list[int],
    ) -> AnnounceResponse:
        announce = await self._get_or_403(announce_id, home_id)
        announce.title = title
        announce.content = content
        announce.priority = priority
        announce.end_date = end_date
        announce.updated_by = user_id

        await self.db.execute(
            delete(AnnounceRecipient).where(AnnounceRecipient.announce_id == announce_id)
        )
        await self.db.flush()
        self.db.expire_all()
        for uid in recipient_ids:
            self.db.add(AnnounceRecipient(announce_id=announce.id, user_id=uid))
        await self.db.flush()

        await log_activity(
            self.db, home_id, user_id, "お知らせを更新しました", "announce", announce_id
        )

        result = await self.db.execute(
            select(Announce)
            .options(
                joinedload(Announce.likes),
                joinedload(Announce.recipients),
                joinedload(Announce.creator),
            )
            .where(Announce.id == announce_id)
        )
        updated = result.scalars().unique().one()
        return self._to_response(updated, user_id)

    async def delete_announce(
        self, announce_id: int, home_id: int, user_id: int
    ) -> None:
        announce = await self._get_or_403(announce_id, home_id)
        await self.db.delete(announce)
        await log_activity(
            self.db, home_id, user_id, "お知らせを削除しました", "announce", announce_id
        )
        await self.db.flush()

    async def toggle_like(
        self, announce_id: int, home_id: int, user_id: int
    ) -> AnnounceLikeResponse:
        announce = await self._get_or_403(announce_id, home_id)
        existing = next((like for like in announce.likes if like.user_id == user_id), None)
        if existing:
            await self.db.delete(existing)
            liked = False
        else:
            self.db.add(AnnounceLike(announce_id=announce_id, user_id=user_id))
            liked = True
        await self.db.flush()
        count_result = await self.db.execute(
            select(func.count())
            .select_from(AnnounceLike)
            .where(AnnounceLike.announce_id == announce_id)
        )
        like_count = count_result.scalar_one()
        return AnnounceLikeResponse(liked=liked, like_count=like_count)

    async def send_push(
        self, announce_id: int, home_id: int, user_id: int
    ) -> None:
        announce = await self._get_or_403(announce_id, home_id)
        await send_push_to_home(
            self.db,
            home_id,
            announce.title,
            announce.content,
            exclude_user_id=user_id,
        )

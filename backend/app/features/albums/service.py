from fastapi import HTTPException, UploadFile
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.features.albums.schemas import (
    AlbumDetailResponse,
    AlbumListResponse,
    AlbumPictureResponse,
)
from app.models.album import Album, AlbumPicture
from app.utils.activity_logger import log_activity
from app.utils.file_storage import delete_image, get_media_url, save_image


class AlbumService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get_or_403(self, album_id: int, home_id: int) -> Album:
        result = await self.db.execute(
            select(Album)
            .options(joinedload(Album.pictures))
            .where(Album.id == album_id)
        )
        album = result.scalars().unique().one_or_none()
        if not album:
            raise HTTPException(status_code=404, detail="アルバムが見つかりません")
        if album.home_id != home_id:
            raise HTTPException(status_code=403, detail="このアルバムへのアクセス権限がありません")
        return album

    def _to_picture_response(self, pic: AlbumPicture) -> AlbumPictureResponse:
        return AlbumPictureResponse(
            id=pic.id,
            album_id=pic.album_id,
            image_url=get_media_url(pic.image_path, settings.MEDIA_BASE_URL) or "",
        )

    def _to_list_response(self, album: Album) -> AlbumListResponse:
        thumbnail_url = (
            get_media_url(album.pictures[0].image_path, settings.MEDIA_BASE_URL)
            if album.pictures
            else None
        )
        return AlbumListResponse(
            id=album.id,
            home_id=album.home_id,
            title=album.title,
            thumbnail_url=thumbnail_url,
            picture_count=len(album.pictures),
            created_at=album.created_at,
        )

    def _to_detail_response(self, album: Album) -> AlbumDetailResponse:
        return AlbumDetailResponse(
            id=album.id,
            home_id=album.home_id,
            title=album.title,
            pictures=[self._to_picture_response(p) for p in album.pictures],
            created_at=album.created_at,
        )

    async def list_albums(
        self, home_id: int, current_home_id: int
    ) -> list[AlbumListResponse]:
        if home_id != current_home_id:
            raise HTTPException(status_code=403, detail="現在選択中のホームのみ参照できます")
        result = await self.db.execute(
            select(Album)
            .options(joinedload(Album.pictures))
            .where(Album.home_id == home_id)
            .order_by(desc(Album.created_at))
        )
        albums = list(result.scalars().unique().all())
        return [self._to_list_response(a) for a in albums]

    async def create_album(
        self,
        home_id: int,
        user_id: int,
        title: str,
        pictures: list[UploadFile],
    ) -> AlbumDetailResponse:
        album = Album(home_id=home_id, title=title, created_by=user_id)
        self.db.add(album)
        await self.db.flush()

        for pic in pictures:
            path = await save_image(pic, directory="pictures", max_mb=10)
            self.db.add(AlbumPicture(album_id=album.id, image_path=path, created_by=user_id))

        await self.db.flush()
        await log_activity(self.db, home_id, user_id, "アルバムを作成しました", "album", album.id)
        return await self.get_album(album.id, home_id)

    async def get_album(self, album_id: int, home_id: int) -> AlbumDetailResponse:
        album = await self._get_or_403(album_id, home_id)
        return self._to_detail_response(album)

    async def update_album(
        self,
        album_id: int,
        home_id: int,
        user_id: int,
        title: str,
        pictures: list[UploadFile],
    ) -> AlbumDetailResponse:
        album = await self._get_or_403(album_id, home_id)
        album.title = title
        album.updated_by = user_id

        for pic in pictures:
            path = await save_image(pic, directory="pictures", max_mb=10)
            self.db.add(AlbumPicture(album_id=album_id, image_path=path, created_by=user_id))

        await self.db.flush()
        self.db.expire(album)
        await log_activity(self.db, home_id, user_id, "アルバムを更新しました", "album", album_id)
        return await self.get_album(album_id, home_id)

    async def delete_album(self, album_id: int, home_id: int, user_id: int) -> None:
        album = await self._get_or_403(album_id, home_id)
        for pic in album.pictures:
            delete_image(pic.image_path)
            await self.db.delete(pic)
        await self.db.flush()
        await self.db.delete(album)
        await log_activity(self.db, home_id, user_id, "アルバムを削除しました", "album", album_id)
        await self.db.flush()

    async def delete_picture(
        self, album_id: int, pic_id: int, home_id: int, user_id: int
    ) -> None:
        album = await self._get_or_403(album_id, home_id)
        pic = next((p for p in album.pictures if p.id == pic_id), None)
        if not pic:
            raise HTTPException(status_code=404, detail="写真が見つかりません")
        delete_image(pic.image_path)
        await self.db.delete(pic)
        await self.db.flush()

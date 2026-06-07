from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_home, get_current_user
from app.features.albums.schemas import AlbumDetailResponse, AlbumListResponse
from app.features.albums.service import AlbumService
from app.models.home import Home
from app.models.user import User

router = APIRouter()


@router.get("/{home_id}", response_model=list[AlbumListResponse])
async def list_albums(
    home_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AlbumListResponse]:
    return await AlbumService(db).list_albums(
        home_id=home_id,
        current_home_id=current_home.id,
    )


@router.post("", response_model=AlbumDetailResponse, status_code=201)
async def create_album(
    title: str = Form(...),
    pictures: Annotated[list[UploadFile], File()] = [],
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AlbumDetailResponse:
    return await AlbumService(db).create_album(
        home_id=current_home.id,
        user_id=current_user.id,
        title=title,
        pictures=pictures,
    )


@router.get("/{album_id}/detail", response_model=AlbumDetailResponse)
async def get_album(
    album_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AlbumDetailResponse:
    return await AlbumService(db).get_album(
        album_id=album_id,
        home_id=current_home.id,
    )


@router.put("/{album_id}", response_model=AlbumDetailResponse)
async def update_album(
    album_id: int,
    title: str = Form(...),
    pictures: Annotated[list[UploadFile], File()] = [],
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AlbumDetailResponse:
    return await AlbumService(db).update_album(
        album_id=album_id,
        home_id=current_home.id,
        user_id=current_user.id,
        title=title,
        pictures=pictures,
    )


@router.delete("/{album_id}", status_code=204)
async def delete_album(
    album_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await AlbumService(db).delete_album(
        album_id=album_id,
        home_id=current_home.id,
        user_id=current_user.id,
    )


@router.delete("/{album_id}/pictures/{pic_id}", status_code=204)
async def delete_picture(
    album_id: int,
    pic_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await AlbumService(db).delete_picture(
        album_id=album_id,
        pic_id=pic_id,
        home_id=current_home.id,
        user_id=current_user.id,
    )

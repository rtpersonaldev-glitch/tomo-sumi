from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Album(Base, TimestampMixin):
    __tablename__ = "albums"

    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(50), nullable=False)

    pictures: Mapped[list[AlbumPicture]] = relationship("AlbumPicture", back_populates="album")


class AlbumPicture(Base, TimestampMixin):
    __tablename__ = "album_pictures"

    id: Mapped[int] = mapped_column(primary_key=True)
    album_id: Mapped[int] = mapped_column(ForeignKey("albums.id"), nullable=False)
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)

    album: Mapped[Album] = relationship("Album", back_populates="pictures")

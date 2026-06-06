from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Post(Base, TimestampMixin):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False, index=True)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)

    pictures: Mapped[list[PostPicture]] = relationship("PostPicture", back_populates="post")
    comments: Mapped[list[PostComment]] = relationship("PostComment", back_populates="post")
    likes: Mapped[list[PostLike]] = relationship("PostLike", back_populates="post")
    tag_links: Mapped[list[PostTagLink]] = relationship("PostTagLink", back_populates="post")


class PostPicture(Base, TimestampMixin):
    __tablename__ = "post_pictures"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), nullable=False)
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)

    post: Mapped[Post] = relationship("Post", back_populates="pictures")


class PostComment(Base, TimestampMixin):
    __tablename__ = "post_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    comment: Mapped[str] = mapped_column(String(100), nullable=False)

    post: Mapped[Post] = relationship("Post", back_populates="comments")


class PostLike(Base):
    __tablename__ = "post_likes"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    post: Mapped[Post] = relationship("Post", back_populates="likes")


class PostTag(Base):
    __tablename__ = "post_tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)

    tag_links: Mapped[list[PostTagLink]] = relationship("PostTagLink", back_populates="tag")


class PostTagLink(Base):
    __tablename__ = "post_tag_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), nullable=False)
    post_tag_id: Mapped[int] = mapped_column(ForeignKey("post_tags.id"), nullable=False)

    post: Mapped[Post] = relationship("Post", back_populates="tag_links")
    tag: Mapped[PostTag] = relationship("PostTag", back_populates="tag_links")

from fastapi import HTTPException, UploadFile
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.features.posts.schemas import (
    PostCommentResponse,
    PostDetailResponse,
    PostLikeResponse,
    PostListResponse,
)
from app.models.post import Post, PostComment, PostLike, PostPicture, PostTagLink
from app.utils.activity_logger import log_activity
from app.utils.file_storage import delete_image, get_media_url, save_image


class PostService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get_or_403(self, post_id: int, home_id: int) -> Post:
        result = await self.db.execute(
            select(Post)
            .options(
                joinedload(Post.pictures),
                joinedload(Post.comments),
                joinedload(Post.likes),
                joinedload(Post.tag_links).joinedload(PostTagLink.tag),
            )
            .where(Post.id == post_id)
            .execution_options(populate_existing=True)
        )
        post = result.scalars().unique().one_or_none()
        if not post:
            raise HTTPException(status_code=404, detail="投稿が見つかりません")
        if post.home_id != home_id:
            raise HTTPException(status_code=403, detail="この投稿へのアクセス権限がありません")
        return post

    def _extract_content(self, post: Post) -> str:
        raw = post.content
        if isinstance(raw, dict):
            return raw.get("text", "")
        return str(raw)

    def _picture_urls(self, post: Post) -> list[str]:
        return [
            url
            for p in post.pictures
            if (url := get_media_url(p.image_path, settings.MEDIA_BASE_URL)) is not None
        ]

    def _picture_ids(self, post: Post) -> list[int]:
        return [
            p.id
            for p in post.pictures
            if get_media_url(p.image_path, settings.MEDIA_BASE_URL) is not None
        ]

    def _to_list_response(self, post: Post, user_id: int) -> PostListResponse:
        return PostListResponse(
            id=post.id,
            home_id=post.home_id,
            content=self._extract_content(post),
            picture_urls=self._picture_urls(post),
            like_count=len(post.likes),
            comment_count=len(post.comments),
            is_liked=any(like.user_id == user_id for like in post.likes),
            created_at=post.created_at,
            created_by=post.created_by,
        )

    def _to_detail_response(self, post: Post, user_id: int) -> PostDetailResponse:
        return PostDetailResponse(
            id=post.id,
            home_id=post.home_id,
            content=self._extract_content(post),
            picture_urls=self._picture_urls(post),
            picture_ids=self._picture_ids(post),
            like_count=len(post.likes),
            is_liked=any(like.user_id == user_id for like in post.likes),
            comments=[PostCommentResponse.model_validate(c) for c in post.comments],
            tags=[link.tag.name for link in post.tag_links],
            created_at=post.created_at,
            created_by=post.created_by,
        )

    async def list_posts(
        self, home_id: int, current_home_id: int, user_id: int
    ) -> list[PostListResponse]:
        if home_id != current_home_id:
            raise HTTPException(status_code=403, detail="現在選択中のホームのみ参照できます")
        result = await self.db.execute(
            select(Post)
            .options(
                joinedload(Post.pictures),
                joinedload(Post.comments),
                joinedload(Post.likes),
            )
            .where(Post.home_id == home_id)
            .order_by(desc(Post.created_at))
        )
        posts = list(result.scalars().unique().all())
        return [self._to_list_response(p, user_id) for p in posts]

    async def create_post(
        self,
        home_id: int,
        user_id: int,
        content: str,
        images: list[UploadFile],
    ) -> PostDetailResponse:
        post = Post(home_id=home_id, content={"text": content}, created_by=user_id)
        self.db.add(post)
        await self.db.flush()

        for image in images:
            path = await save_image(image, directory="post_pictures", max_mb=10)
            self.db.add(PostPicture(post_id=post.id, image_path=path, created_by=user_id))

        await self.db.flush()
        await log_activity(self.db, home_id, user_id, "投稿を作成しました", "post", post.id)
        return await self.get_post(post.id, home_id, user_id)

    async def get_post(self, post_id: int, home_id: int, user_id: int) -> PostDetailResponse:
        post = await self._get_or_403(post_id, home_id)
        return self._to_detail_response(post, user_id)

    async def update_post(
        self,
        post_id: int,
        home_id: int,
        user_id: int,
        content: str,
        new_images: list[UploadFile] | None = None,
        delete_picture_ids: list[int] | None = None,
    ) -> PostDetailResponse:
        post = await self._get_or_403(post_id, home_id)
        post.content = {"text": content}
        post.updated_by = user_id

        deleted_ids = set(delete_picture_ids or [])
        for pic in list(post.pictures):
            if pic.id in deleted_ids:
                delete_image(pic.image_path)
                await self.db.delete(pic)

        if new_images:
            remaining = sum(1 for p in post.pictures if p.id not in deleted_ids)
            for image in new_images:
                if remaining >= 5:
                    break
                path = await save_image(image, directory="post_pictures", max_mb=10)
                self.db.add(PostPicture(post_id=post.id, image_path=path, created_by=user_id))
                remaining += 1

        await self.db.flush()
        await log_activity(self.db, home_id, user_id, "投稿を更新しました", "post", post_id)
        return await self.get_post(post.id, home_id, user_id)

    async def delete_post(self, post_id: int, home_id: int, user_id: int) -> None:
        post = await self._get_or_403(post_id, home_id)
        for pic in post.pictures:
            delete_image(pic.image_path)
            await self.db.delete(pic)
        for comment in post.comments:
            await self.db.delete(comment)
        for like in post.likes:
            await self.db.delete(like)
        for tag_link in post.tag_links:
            await self.db.delete(tag_link)
        await self.db.flush()
        await self.db.delete(post)
        await log_activity(self.db, home_id, user_id, "投稿を削除しました", "post", post_id)
        await self.db.flush()

    async def toggle_like(
        self, post_id: int, home_id: int, user_id: int
    ) -> PostLikeResponse:
        post = await self._get_or_403(post_id, home_id)
        existing = next((like for like in post.likes if like.user_id == user_id), None)
        if existing:
            await self.db.delete(existing)
            liked = False
        else:
            self.db.add(PostLike(post_id=post_id, user_id=user_id))
            liked = True
        await self.db.flush()
        count_result = await self.db.execute(
            select(func.count()).select_from(PostLike).where(PostLike.post_id == post_id)
        )
        like_count = count_result.scalar_one()
        return PostLikeResponse(liked=liked, like_count=like_count)

    async def add_comment(
        self, post_id: int, home_id: int, user_id: int, comment: str
    ) -> PostCommentResponse:
        await self._get_or_403(post_id, home_id)
        new_comment = PostComment(
            post_id=post_id, user_id=user_id, comment=comment, created_by=user_id
        )
        self.db.add(new_comment)
        await self.db.flush()
        await self.db.refresh(new_comment)
        await log_activity(
            self.db, home_id, user_id, "コメントを追加しました", "post_comment", new_comment.id
        )
        return PostCommentResponse.model_validate(new_comment)

    async def delete_comment(
        self, post_id: int, comment_id: int, home_id: int, user_id: int
    ) -> None:
        await self._get_or_403(post_id, home_id)
        comment = await self.db.get(PostComment, comment_id)
        if not comment or comment.post_id != post_id:
            raise HTTPException(status_code=404, detail="コメントが見つかりません")
        if comment.user_id != user_id:
            raise HTTPException(status_code=403, detail="自分のコメントのみ削除できます")
        await self.db.delete(comment)
        await self.db.flush()

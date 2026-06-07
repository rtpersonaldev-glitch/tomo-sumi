from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_home, get_current_user
from app.features.posts.schemas import (
    PostCommentCreateRequest,
    PostCommentResponse,
    PostDetailResponse,
    PostLikeResponse,
    PostListResponse,
    PostUpdateRequest,
)
from app.features.posts.service import PostService
from app.models.home import Home
from app.models.user import User

router = APIRouter()


@router.get("/{home_id}", response_model=list[PostListResponse])
async def list_posts(
    home_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PostListResponse]:
    return await PostService(db).list_posts(
        home_id=home_id,
        current_home_id=current_home.id,
        user_id=current_user.id,
    )


@router.post("", response_model=PostDetailResponse, status_code=201)
async def create_post(
    content: str = Form(...),
    images: Annotated[list[UploadFile], File()] = [],
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PostDetailResponse:
    return await PostService(db).create_post(
        home_id=current_home.id,
        user_id=current_user.id,
        content=content,
        images=images,
    )


@router.get("/{post_id}/detail", response_model=PostDetailResponse)
async def get_post(
    post_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PostDetailResponse:
    return await PostService(db).get_post(
        post_id=post_id,
        home_id=current_home.id,
        user_id=current_user.id,
    )


@router.put("/{post_id}", response_model=PostDetailResponse)
async def update_post(
    post_id: int,
    body: PostUpdateRequest,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PostDetailResponse:
    return await PostService(db).update_post(
        post_id=post_id,
        home_id=current_home.id,
        user_id=current_user.id,
        content=body.content,
    )


@router.delete("/{post_id}", status_code=204)
async def delete_post(
    post_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await PostService(db).delete_post(
        post_id=post_id,
        home_id=current_home.id,
        user_id=current_user.id,
    )


@router.post("/{post_id}/like", response_model=PostLikeResponse)
async def toggle_like(
    post_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PostLikeResponse:
    return await PostService(db).toggle_like(
        post_id=post_id,
        home_id=current_home.id,
        user_id=current_user.id,
    )


@router.post("/{post_id}/comments", response_model=PostCommentResponse, status_code=201)
async def add_comment(
    post_id: int,
    body: PostCommentCreateRequest,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PostCommentResponse:
    return await PostService(db).add_comment(
        post_id=post_id,
        home_id=current_home.id,
        user_id=current_user.id,
        comment=body.comment,
    )


@router.delete("/{post_id}/comments/{comment_id}", status_code=204)
async def delete_comment(
    post_id: int,
    comment_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await PostService(db).delete_comment(
        post_id=post_id,
        comment_id=comment_id,
        home_id=current_home.id,
        user_id=current_user.id,
    )

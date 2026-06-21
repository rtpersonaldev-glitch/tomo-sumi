import io
from pathlib import Path
from unittest.mock import patch

from httpx import AsyncClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import app.utils.file_storage as fs
from app.models.activity import ActivityLog
from app.models.home import Home
from app.models.post import Post, PostComment
from app.models.user import User

_SEQ = 0


def _unique_email() -> str:
    global _SEQ
    _SEQ += 1
    return f"post_user{_SEQ}@example.com"


async def _register_and_login(
    client: AsyncClient,
    email: str | None = None,
    nickname: str = "テストユーザー",
) -> int:
    email = email or _unique_email()
    payload = {"email": email, "password": "TestPass123!", "nickname": nickname}
    await client.post("/api/auth/register", json=payload)
    await client.post("/api/auth/login", json={"email": email, "password": "TestPass123!"})
    me = await client.get("/api/auth/me")
    return me.json()["user"]["id"]


async def _create_and_select_home(client: AsyncClient, name: str = "テストホーム") -> int:
    resp = await client.post("/api/homes", json={"name": name})
    home_id = resp.json()["id"]
    await client.post(f"/api/auth/home-login/{home_id}")
    return home_id


# ─── GET /api/posts/{home_id} ─────────────────────────────────────────────────


async def test_list_posts_empty(client: AsyncClient) -> None:
    """投稿がない場合は空リストを返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.get(f"/api/posts/{home_id}")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_posts(client: AsyncClient) -> None:
    """投稿一覧を返す（コメント数・いいね数含む）"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/posts", data={"content": "テスト投稿"})
    resp = await client.get(f"/api/posts/{home_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["content"] == "テスト投稿"
    assert data[0]["like_count"] == 0
    assert data[0]["comment_count"] == 0
    assert data[0]["is_liked"] is False


async def test_list_posts_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームの投稿一覧は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    resp = await client.get(f"/api/posts/{other_home.id}")
    assert resp.status_code == 403


# ─── POST /api/posts ──────────────────────────────────────────────────────────


async def test_create_post(client: AsyncClient) -> None:
    """投稿を作成すると 201 と作成データを返す"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    resp = await client.post("/api/posts", data={"content": "テスト投稿内容"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["content"] == "テスト投稿内容"
    assert data["picture_urls"] == []
    assert data["like_count"] == 0
    assert data["is_liked"] is False
    assert data["comments"] == []
    assert data["tags"] == []


async def test_create_post_unauthenticated(client: AsyncClient) -> None:
    """未認証時は 401 を返す"""
    resp = await client.post("/api/posts", data={"content": "未認証投稿"})
    assert resp.status_code == 401


async def test_create_post_with_images(client: AsyncClient, tmp_path: Path) -> None:
    """画像付きで投稿を作成すると picture_urls に格納される"""
    await _register_and_login(client)
    await _create_and_select_home(client)

    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color=(0, 0, 255)).save(buf, format="PNG")
    png_bytes = buf.getvalue()

    with patch.object(fs, "MEDIA_ROOT", tmp_path):
        resp = await client.post(
            "/api/posts",
            data={"content": "画像付き投稿"},
            files=[("images", ("pic.png", png_bytes, "image/png"))],
        )

    assert resp.status_code == 201
    data = resp.json()
    assert data["content"] == "画像付き投稿"
    assert len(data["picture_urls"]) == 1


# ─── GET /api/posts/{id}/detail ──────────────────────────────────────────────


async def test_get_post_detail(client: AsyncClient) -> None:
    """投稿詳細を取得できる（コメント・いいね・タグ含む）"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/posts", data={"content": "詳細テスト"})
    post_id = create_resp.json()["id"]
    resp = await client.get(f"/api/posts/{post_id}/detail")
    assert resp.status_code == 200
    data = resp.json()
    assert data["content"] == "詳細テスト"
    assert "comments" in data
    assert "tags" in data


async def test_get_post_detail_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームの投稿詳細は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    post = Post(home_id=other_home.id, content={"text": "他の投稿"})
    db.add(post)
    await db.flush()
    resp = await client.get(f"/api/posts/{post.id}/detail")
    assert resp.status_code == 403


# ─── PUT /api/posts/{id} ─────────────────────────────────────────────────────


async def test_update_post(client: AsyncClient) -> None:
    """投稿内容を更新できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/posts", data={"content": "元の内容"})
    post_id = create_resp.json()["id"]
    resp = await client.put(f"/api/posts/{post_id}", data={"content": "更新後の内容"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["content"] == "更新後の内容"
    assert "picture_ids" in data


async def test_update_post_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームの投稿更新は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    post = Post(home_id=other_home.id, content={"text": "他の投稿"})
    db.add(post)
    await db.flush()
    resp = await client.put(f"/api/posts/{post.id}", data={"content": "変更試み"})
    assert resp.status_code == 403


async def test_update_post_add_image(client: AsyncClient, tmp_path: Path) -> None:
    """投稿編集で画像を追加できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/posts", data={"content": "画像追加前"})
    post_id = create_resp.json()["id"]
    assert create_resp.json()["picture_urls"] == []

    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color=(255, 0, 0)).save(buf, format="PNG")
    png_bytes = buf.getvalue()

    with patch.object(fs, "MEDIA_ROOT", tmp_path):
        resp = await client.put(
            f"/api/posts/{post_id}",
            data={"content": "画像追加後"},
            files=[("new_images", ("new.png", png_bytes, "image/png"))],
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["content"] == "画像追加後"
    assert len(data["picture_urls"]) == 1
    assert len(data["picture_ids"]) == 1


async def test_update_post_delete_image(client: AsyncClient, tmp_path: Path) -> None:
    """投稿編集で既存画像を削除できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)

    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color=(0, 255, 0)).save(buf, format="PNG")
    png_bytes = buf.getvalue()

    with patch.object(fs, "MEDIA_ROOT", tmp_path):
        create_resp = await client.post(
            "/api/posts",
            data={"content": "画像削除テスト"},
            files=[("images", ("img.png", png_bytes, "image/png"))],
        )
    assert len(create_resp.json()["picture_ids"]) == 1
    picture_id = create_resp.json()["picture_ids"][0]
    post_id = create_resp.json()["id"]

    import json as _json
    with patch.object(fs, "MEDIA_ROOT", tmp_path):
        resp = await client.put(
            f"/api/posts/{post_id}",
            data={
                "content": "画像削除後",
                "delete_picture_ids": _json.dumps([picture_id]),
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["picture_urls"] == []
    assert data["picture_ids"] == []


# ─── DELETE /api/posts/{id} ──────────────────────────────────────────────────


async def test_delete_post(client: AsyncClient) -> None:
    """投稿を削除すると 204 を返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post("/api/posts", data={"content": "削除テスト"})
    post_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/posts/{post_id}")
    assert resp.status_code == 204
    list_resp = await client.get(f"/api/posts/{home_id}")
    assert list_resp.json() == []


async def test_delete_post_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームの投稿削除は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    post = Post(home_id=other_home.id, content={"text": "他の投稿"})
    db.add(post)
    await db.flush()
    resp = await client.delete(f"/api/posts/{post.id}")
    assert resp.status_code == 403


# ─── POST /api/posts/{id}/like ────────────────────────────────────────────────


async def test_toggle_like_on(client: AsyncClient) -> None:
    """いいねを追加すると liked: true を返す"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/posts", data={"content": "いいねテスト"})
    post_id = create_resp.json()["id"]
    resp = await client.post(f"/api/posts/{post_id}/like")
    assert resp.status_code == 200
    data = resp.json()
    assert data["liked"] is True
    assert data["like_count"] == 1


async def test_toggle_like_off(client: AsyncClient) -> None:
    """いいねを2回押すと liked: false になる（冪等）"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/posts", data={"content": "いいねトグルテスト"})
    post_id = create_resp.json()["id"]
    await client.post(f"/api/posts/{post_id}/like")
    resp = await client.post(f"/api/posts/{post_id}/like")
    assert resp.status_code == 200
    data = resp.json()
    assert data["liked"] is False
    assert data["like_count"] == 0


# ─── POST /api/posts/{id}/comments ───────────────────────────────────────────


async def test_add_comment(client: AsyncClient) -> None:
    """コメントを追加すると 201 とコメントデータを返す"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/posts", data={"content": "コメントテスト"})
    post_id = create_resp.json()["id"]
    resp = await client.post(
        f"/api/posts/{post_id}/comments", json={"comment": "テストコメント"}
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["comment"] == "テストコメント"
    assert data["post_id"] == post_id


async def test_comment_appears_in_detail(client: AsyncClient) -> None:
    """コメント追加後に詳細を取得するとコメントが含まれる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/posts", data={"content": "詳細確認テスト"})
    post_id = create_resp.json()["id"]
    await client.post(f"/api/posts/{post_id}/comments", json={"comment": "詳細コメント"})
    detail_resp = await client.get(f"/api/posts/{post_id}/detail")
    comments = detail_resp.json()["comments"]
    assert len(comments) == 1
    assert comments[0]["comment"] == "詳細コメント"


# ─── DELETE /api/posts/{id}/comments/{comment_id} ────────────────────────────


async def test_delete_comment(client: AsyncClient) -> None:
    """自分のコメントを削除すると 204 を返す"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/posts", data={"content": "コメント削除テスト"})
    post_id = create_resp.json()["id"]
    comment_resp = await client.post(
        f"/api/posts/{post_id}/comments", json={"comment": "削除するコメント"}
    )
    comment_id = comment_resp.json()["id"]
    resp = await client.delete(f"/api/posts/{post_id}/comments/{comment_id}")
    assert resp.status_code == 204


async def test_delete_comment_other_user(client: AsyncClient, db: AsyncSession) -> None:
    """他ユーザーのコメント削除は 403"""
    user_id = await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/posts", data={"content": "他ユーザーコメントテスト"})
    post_id = create_resp.json()["id"]

    other_user = User(
        email="other_commenter@example.com",
        hashed_password="dummy_hash",
        nickname="他のユーザー",
    )
    db.add(other_user)
    await db.flush()

    other_comment = PostComment(
        post_id=post_id, user_id=other_user.id, comment="他ユーザーのコメント"
    )
    db.add(other_comment)
    await db.flush()

    resp = await client.delete(f"/api/posts/{post_id}/comments/{other_comment.id}")
    assert resp.status_code == 403


# ─── アクティビティログ検証 ────────────────────────────────────────────────────


async def test_activity_log_on_create_post(client: AsyncClient, db: AsyncSession) -> None:
    """投稿作成でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/posts", data={"content": "ログテスト投稿"})
    result = await db.execute(select(ActivityLog).where(ActivityLog.home_id == home_id))
    logs = result.scalars().all()
    assert any("作成" in log.action for log in logs)


async def test_activity_log_on_delete_post(client: AsyncClient, db: AsyncSession) -> None:
    """投稿削除でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post("/api/posts", data={"content": "削除ログテスト"})
    post_id = create_resp.json()["id"]
    await client.delete(f"/api/posts/{post_id}")
    result = await db.execute(select(ActivityLog).where(ActivityLog.home_id == home_id))
    logs = result.scalars().all()
    assert any("削除" in log.action for log in logs)

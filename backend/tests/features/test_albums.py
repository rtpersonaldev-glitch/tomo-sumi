from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.album import Album, AlbumPicture
from app.models.home import Home

_SEQ = 0


def _unique_email() -> str:
    global _SEQ
    _SEQ += 1
    return f"album_user{_SEQ}@example.com"


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


# ─── GET /api/albums/{home_id} ────────────────────────────────────────────────


async def test_list_albums_empty(client: AsyncClient) -> None:
    """アルバムがない場合は空リストを返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.get(f"/api/albums/{home_id}")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_albums(client: AsyncClient) -> None:
    """アルバム一覧をサムネイル情報付きで返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/albums", data={"title": "テストアルバム"})
    resp = await client.get(f"/api/albums/{home_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "テストアルバム"
    assert data[0]["picture_count"] == 0
    assert data[0]["thumbnail_url"] is None


async def test_list_albums_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームのアルバム一覧は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    resp = await client.get(f"/api/albums/{other_home.id}")
    assert resp.status_code == 403


# ─── POST /api/albums ─────────────────────────────────────────────────────────


async def test_create_album(client: AsyncClient) -> None:
    """アルバムを作成すると 201 と詳細データを返す"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    resp = await client.post("/api/albums", data={"title": "新しいアルバム"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "新しいアルバム"
    assert data["pictures"] == []


async def test_create_album_unauthenticated(client: AsyncClient) -> None:
    """未認証時は 401 を返す"""
    resp = await client.post("/api/albums", data={"title": "未認証アルバム"})
    assert resp.status_code == 401


# ─── GET /api/albums/{id}/detail ──────────────────────────────────────────────


async def test_get_album_detail(client: AsyncClient) -> None:
    """アルバム詳細を取得できる（写真一覧含む）"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/albums", data={"title": "詳細テスト"})
    album_id = create_resp.json()["id"]
    resp = await client.get(f"/api/albums/{album_id}/detail")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "詳細テスト"
    assert "pictures" in data


async def test_get_album_detail_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームのアルバム詳細は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    album = Album(home_id=other_home.id, title="他のアルバム")
    db.add(album)
    await db.flush()
    resp = await client.get(f"/api/albums/{album.id}/detail")
    assert resp.status_code == 403


# ─── PUT /api/albums/{id} ─────────────────────────────────────────────────────


async def test_update_album_title(client: AsyncClient) -> None:
    """アルバムタイトルを更新できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/albums", data={"title": "元のタイトル"})
    album_id = create_resp.json()["id"]
    resp = await client.put(f"/api/albums/{album_id}", data={"title": "更新後タイトル"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "更新後タイトル"


async def test_update_album_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームのアルバム更新は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    album = Album(home_id=other_home.id, title="他のアルバム")
    db.add(album)
    await db.flush()
    resp = await client.put(f"/api/albums/{album.id}", data={"title": "変更試み"})
    assert resp.status_code == 403


# ─── DELETE /api/albums/{id} ──────────────────────────────────────────────────


async def test_delete_album(client: AsyncClient) -> None:
    """アルバムを削除すると 204 を返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post("/api/albums", data={"title": "削除テスト"})
    album_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/albums/{album_id}")
    assert resp.status_code == 204
    list_resp = await client.get(f"/api/albums/{home_id}")
    assert list_resp.json() == []


async def test_delete_album_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームのアルバム削除は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    album = Album(home_id=other_home.id, title="他のアルバム")
    db.add(album)
    await db.flush()
    resp = await client.delete(f"/api/albums/{album.id}")
    assert resp.status_code == 403


async def test_delete_album_removes_pictures(client: AsyncClient, db: AsyncSession) -> None:
    """アルバム削除時に紐付く写真レコードも削除される"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/albums", data={"title": "写真付きアルバム"})
    album_id = create_resp.json()["id"]

    pic = AlbumPicture(album_id=album_id, image_path="pictures/test_del.jpg")
    db.add(pic)
    await db.flush()

    resp = await client.delete(f"/api/albums/{album_id}")
    assert resp.status_code == 204

    deleted_pic = await db.get(AlbumPicture, pic.id)
    assert deleted_pic is None


# ─── DELETE /api/albums/{id}/pictures/{pic_id} ────────────────────────────────


async def test_delete_picture(client: AsyncClient, db: AsyncSession) -> None:
    """特定の写真を削除すると 204 を返す"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/albums", data={"title": "写真削除テスト"})
    album_id = create_resp.json()["id"]

    pic = AlbumPicture(album_id=album_id, image_path="pictures/test_pic.jpg")
    db.add(pic)
    await db.flush()

    resp = await client.delete(f"/api/albums/{album_id}/pictures/{pic.id}")
    assert resp.status_code == 204

    deleted_pic = await db.get(AlbumPicture, pic.id)
    assert deleted_pic is None


async def test_delete_picture_not_found(client: AsyncClient) -> None:
    """存在しない写真の削除は 404"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/albums", data={"title": "404テスト"})
    album_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/albums/{album_id}/pictures/99999")
    assert resp.status_code == 404


async def test_delete_picture_wrong_album(client: AsyncClient, db: AsyncSession) -> None:
    """他アルバムの写真削除は 404"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    album1_resp = await client.post("/api/albums", data={"title": "アルバム1"})
    album2_resp = await client.post("/api/albums", data={"title": "アルバム2"})
    album1_id = album1_resp.json()["id"]
    album2_id = album2_resp.json()["id"]

    pic = AlbumPicture(album_id=album2_id, image_path="pictures/other.jpg")
    db.add(pic)
    await db.flush()

    resp = await client.delete(f"/api/albums/{album1_id}/pictures/{pic.id}")
    assert resp.status_code == 404


# ─── アクティビティログ検証 ────────────────────────────────────────────────────


async def test_activity_log_on_create_album(client: AsyncClient) -> None:
    """アルバム作成でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/albums", data={"title": "ログテスト"})
    logs_resp = await client.get(f"/api/activity/{home_id}")
    logs = logs_resp.json()
    assert any("作成" in log["action"] for log in logs)


async def test_activity_log_on_delete_album(client: AsyncClient) -> None:
    """アルバム削除でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post("/api/albums", data={"title": "削除ログテスト"})
    album_id = create_resp.json()["id"]
    await client.delete(f"/api/albums/{album_id}")
    logs_resp = await client.get(f"/api/activity/{home_id}")
    logs = logs_resp.json()
    assert any("削除" in log["action"] for log in logs)

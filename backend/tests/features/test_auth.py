import io
from pathlib import Path
from unittest.mock import patch

from httpx import AsyncClient
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

import app.utils.file_storage as fs
from app.models.home import Home, HomeLink

REGISTER_PAYLOAD = {
    "email": "test@example.com",
    "password": "TestPass123!",
    "nickname": "テストユーザー",
}


async def _register_and_login(client: AsyncClient) -> None:
    await client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    await client.post(
        "/api/auth/login",
        json={"email": REGISTER_PAYLOAD["email"], "password": REGISTER_PAYLOAD["password"]},
    )


async def _create_home_for_user(db: AsyncSession, user_id: int) -> Home:
    home = Home(name="テストホーム")
    db.add(home)
    await db.flush()
    db.add(HomeLink(user_id=user_id, home_id=home.id))
    await db.flush()
    return home


# ─── register ─────────────────────────────────────────────────────────────────


async def test_register_success(client: AsyncClient) -> None:
    resp = await client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == REGISTER_PAYLOAD["email"]
    assert data["nickname"] == REGISTER_PAYLOAD["nickname"]
    assert "hashed_password" not in data


async def test_register_duplicate_email(client: AsyncClient) -> None:
    await client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    resp = await client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    assert resp.status_code == 400


async def test_register_short_password(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/auth/register",
        json={**REGISTER_PAYLOAD, "password": "short"},
    )
    assert resp.status_code == 422


# ─── login ────────────────────────────────────────────────────────────────────


async def test_login_success(client: AsyncClient) -> None:
    await client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    resp = await client.post(
        "/api/auth/login",
        json={"email": REGISTER_PAYLOAD["email"], "password": REGISTER_PAYLOAD["password"]},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.cookies
    assert "refresh_token" in resp.cookies


async def test_login_wrong_password(client: AsyncClient) -> None:
    await client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    resp = await client.post(
        "/api/auth/login",
        json={"email": REGISTER_PAYLOAD["email"], "password": "WrongPass!"},
    )
    assert resp.status_code == 401


async def test_login_unknown_email(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "TestPass123!"},
    )
    assert resp.status_code == 401


# ─── /me ──────────────────────────────────────────────────────────────────────


async def test_me_success(client: AsyncClient) -> None:
    await _register_and_login(client)
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["email"] == REGISTER_PAYLOAD["email"]
    assert isinstance(data["homes"], list)


async def test_me_unauthenticated(client: AsyncClient) -> None:
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


# ─── home-login ───────────────────────────────────────────────────────────────


async def test_home_login_success(client: AsyncClient, db: AsyncSession) -> None:
    await _register_and_login(client)
    user_id = (await client.get("/api/auth/me")).json()["user"]["id"]
    home = await _create_home_for_user(db, user_id)

    resp = await client.post(f"/api/auth/home-login/{home.id}")
    assert resp.status_code == 200

    me = await client.get("/api/auth/me")
    assert me.json()["home"]["id"] == home.id


async def test_me_home_image_url(client: AsyncClient, db: AsyncSession, tmp_path: Path) -> None:
    """ホーム画像パスがURLに変換されて /me から返る"""
    import io as _io

    from PIL import Image as _Image

    from app.models.home import Home as _Home, HomeLink as _HomeLink

    await _register_and_login(client)
    user_id = (await client.get("/api/auth/me")).json()["user"]["id"]

    home = _Home(name="画像付きホーム", home_image_path="home_images/test.jpg")
    db.add(home)
    await db.flush()
    db.add(_HomeLink(user_id=user_id, home_id=home.id))
    await db.flush()
    await client.post(f"/api/auth/home-login/{home.id}")

    me = await client.get("/api/auth/me")
    assert me.status_code == 200
    home_data = me.json()["home"]
    assert home_data is not None
    assert "home_image_url" in home_data
    assert "home_image_path" not in home_data
    assert home_data["home_image_url"] is not None
    assert home_data["home_image_url"].startswith("http")
    assert "home_images/test.jpg" in home_data["home_image_url"]


async def test_home_login_not_member(client: AsyncClient, db: AsyncSession) -> None:
    await _register_and_login(client)
    # ホームを作成するがhome_linkを作成しない
    home = Home(name="他人のホーム")
    db.add(home)
    await db.flush()

    resp = await client.post(f"/api/auth/home-login/{home.id}")
    assert resp.status_code == 403


# ─── home-logout ──────────────────────────────────────────────────────────────


async def test_home_logout(client: AsyncClient, db: AsyncSession) -> None:
    await _register_and_login(client)
    user_id = (await client.get("/api/auth/me")).json()["user"]["id"]
    home = await _create_home_for_user(db, user_id)
    await client.post(f"/api/auth/home-login/{home.id}")

    resp = await client.post("/api/auth/home-logout")
    assert resp.status_code == 200
    me = await client.get("/api/auth/me")
    assert me.json()["home"] is None


# ─── refresh ──────────────────────────────────────────────────────────────────


async def test_refresh_success(client: AsyncClient) -> None:
    await _register_and_login(client)
    resp = await client.post("/api/auth/refresh")
    assert resp.status_code == 200
    assert "access_token" in resp.cookies


async def test_refresh_no_token(client: AsyncClient) -> None:
    resp = await client.post("/api/auth/refresh")
    assert resp.status_code == 401


# ─── logout ───────────────────────────────────────────────────────────────────


async def test_logout_success(client: AsyncClient) -> None:
    await _register_and_login(client)
    resp = await client.post("/api/auth/logout")
    assert resp.status_code == 200


async def test_logout_unauthenticated(client: AsyncClient) -> None:
    resp = await client.post("/api/auth/logout")
    assert resp.status_code == 401


# ─── profile ──────────────────────────────────────────────────────────────────


async def test_update_profile(client: AsyncClient) -> None:
    await _register_and_login(client)
    resp = await client.put("/api/auth/profile", data={"nickname": "新しい名前"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["nickname"] == "新しい名前"
    assert data["icon_url"] is None


async def test_update_profile_with_icon(client: AsyncClient, tmp_path: Path) -> None:
    """アイコン画像付きでプロフィールを更新できる"""
    await _register_and_login(client)

    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color=(0, 128, 255)).save(buf, format="PNG")
    png_bytes = buf.getvalue()

    with patch.object(fs, "MEDIA_ROOT", tmp_path):
        resp = await client.put(
            "/api/auth/profile",
            data={"nickname": "アイコン付き"},
            files={"icon": ("icon.png", png_bytes, "image/png")},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["nickname"] == "アイコン付き"
    assert data["icon_url"] is not None
    assert "icons/" in data["icon_url"]


async def test_update_profile_invalid_icon(client: AsyncClient) -> None:
    """非対応形式のファイルで 400 を返す"""
    await _register_and_login(client)
    resp = await client.put(
        "/api/auth/profile",
        data={"nickname": "テスト"},
        files={"icon": ("doc.pdf", b"fake-pdf", "application/pdf")},
    )
    assert resp.status_code == 400


# ─── status toggle ────────────────────────────────────────────────────────────


async def test_status_toggle(client: AsyncClient) -> None:
    await _register_and_login(client)
    me = await client.get("/api/auth/me")
    initial_status = me.json()["user"]["status"]

    resp = await client.post("/api/auth/status/toggle")
    assert resp.status_code == 200
    toggled = resp.json()["status"]
    assert toggled != initial_status

    resp2 = await client.post("/api/auth/status/toggle")
    assert resp2.json()["status"] == initial_status


# ─── notification ─────────────────────────────────────────────────────────────


async def test_notification_toggle(client: AsyncClient) -> None:
    await _register_and_login(client)
    settings_resp = await client.get("/api/auth/settings")
    initial_flag = settings_resp.json()["notification_flag"]

    toggle_resp = await client.post("/api/auth/notification/toggle")
    assert toggle_resp.status_code == 200
    assert toggle_resp.json()["notification_flag"] != initial_flag


# ─── full flow ────────────────────────────────────────────────────────────────


async def test_full_auth_flow(client: AsyncClient, db: AsyncSession) -> None:
    """register → login → home-login → refresh → logout"""
    # register
    reg = await client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    assert reg.status_code == 201

    # login
    login = await client.post(
        "/api/auth/login",
        json={"email": REGISTER_PAYLOAD["email"], "password": REGISTER_PAYLOAD["password"]},
    )
    assert login.status_code == 200

    # home-login
    user_id = (await client.get("/api/auth/me")).json()["user"]["id"]
    home = await _create_home_for_user(db, user_id)
    home_login = await client.post(f"/api/auth/home-login/{home.id}")
    assert home_login.status_code == 200

    # refresh
    refresh = await client.post("/api/auth/refresh")
    assert refresh.status_code == 200

    # logout
    logout = await client.post("/api/auth/logout")
    assert logout.status_code == 200

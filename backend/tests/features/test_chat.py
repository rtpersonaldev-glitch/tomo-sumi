import io
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from PIL import Image
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

import app.utils.file_storage as fs
from app.core.security import create_access_token
from app.main import app

_SEQ = 0


def _unique_email() -> str:
    global _SEQ
    _SEQ += 1
    return f"chat_user{_SEQ}@example.com"


async def _register_and_login(
    client: AsyncClient,
    email: str | None = None,
    nickname: str = "テストユーザー",
) -> int:
    email = email or _unique_email()
    await client.post(
        "/api/auth/register",
        json={"email": email, "password": "TestPass123!", "nickname": nickname},
    )
    await client.post("/api/auth/login", json={"email": email, "password": "TestPass123!"})
    me = await client.get("/api/auth/me")
    return me.json()["user"]["id"]


async def _create_and_select_home(client: AsyncClient, name: str = "テストホーム") -> int:
    resp = await client.post("/api/homes", json={"name": name})
    home_id = resp.json()["id"]
    await client.post(f"/api/auth/home-login/{home_id}")
    return home_id


# ─── GET /api/chat/{home_id}/messages ────────────────────────────────────────


async def test_get_history_empty(client: AsyncClient) -> None:
    """メッセージがない場合は空リストを返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.get(f"/api/chat/{home_id}/messages")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_history_unauthenticated(client: AsyncClient) -> None:
    """未認証時は 401"""
    resp = await client.get("/api/chat/1/messages")
    assert resp.status_code == 401


async def test_get_history_wrong_home(client: AsyncClient) -> None:
    """他ホームの履歴は 403"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    other_home_id = home_id + 9999
    resp = await client.get(f"/api/chat/{other_home_id}/messages")
    assert resp.status_code == 403


async def test_get_history_with_limit(client: AsyncClient) -> None:
    """limit パラメータが受け付けられる"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.get(f"/api/chat/{home_id}/messages?limit=10")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ─── POST /api/chat/{home_id}/images ─────────────────────────────────────────


async def test_upload_chat_image_unauthenticated(client: AsyncClient) -> None:
    """未認証時は 401"""
    resp = await client.post("/api/chat/1/images", files={"image": ("a.jpg", b"", "image/jpeg")})
    assert resp.status_code == 401


async def test_upload_chat_image_success(client: AsyncClient, tmp_path: Path) -> None:
    """チャット画像をアップロードすると 200 と image_url を返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)

    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color=(128, 0, 128)).save(buf, format="JPEG")
    buf.seek(0)

    with patch.object(fs, "MEDIA_ROOT", tmp_path):
        resp = await client.post(
            f"/api/chat/{home_id}/images",
            files={"image": ("chat.jpg", buf.read(), "image/jpeg")},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert "image_path" in data
    assert data["image_path"].startswith("chat_pictures/")


async def test_upload_chat_image_wrong_home(client: AsyncClient) -> None:
    """他ホームへの画像アップロードは 403"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    other_home_id = home_id + 9999

    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color=(255, 0, 0)).save(buf, format="JPEG")
    buf.seek(0)

    resp = await client.post(
        f"/api/chat/{other_home_id}/images",
        files={"image": ("test.jpg", buf.read(), "image/jpeg")},
    )
    assert resp.status_code == 403


# ─── WebSocket: 認証エラー ────────────────────────────────────────────────────


def test_ws_close_no_auth() -> None:
    """Cookieなし接続は 4001 でクローズされる"""
    client = TestClient(app, raise_server_exceptions=False)
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/api/chat/ws/1") as ws:
            ws.receive_json()
    assert exc.value.code == 4001


def test_ws_close_wrong_home() -> None:
    """JWTのhome_idと接続先home_idが一致しない場合は 4003 でクローズされる"""
    token = create_access_token(user_id=1, home_id=1)
    client = TestClient(app, raise_server_exceptions=False)
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(
            "/api/chat/ws/99",
            cookies={"access_token": token},
        ) as ws:
            ws.receive_json()
    assert exc.value.code == 4003


def test_ws_close_no_home_in_token() -> None:
    """JWTにhome_idがない（ホーム未選択）場合は 4003 でクローズされる"""
    token = create_access_token(user_id=1, home_id=None)
    client = TestClient(app, raise_server_exceptions=False)
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(
            "/api/chat/ws/1",
            cookies={"access_token": token},
        ) as ws:
            ws.receive_json()
    assert exc.value.code == 4003



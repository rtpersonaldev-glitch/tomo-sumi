import logging
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

import app.utils.fcm as fcm_module
from app.models.home import Home, HomeLink
from app.models.user import FCMToken, User

REGISTER_PAYLOAD = {
    "email": "test@example.com",
    "password": "TestPass123!",
    "nickname": "テストユーザー",
}


async def _register_and_login(client: AsyncClient) -> int:
    await client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    await client.post(
        "/api/auth/login",
        json={"email": REGISTER_PAYLOAD["email"], "password": REGISTER_PAYLOAD["password"]},
    )
    me = await client.get("/api/auth/me")
    return me.json()["user"]["id"]


# ─── POST /api/auth/fcm-token ─────────────────────────────────────────────────


async def test_register_fcm_token(client: AsyncClient, db: AsyncSession) -> None:
    """FCMトークンを登録すると 204 を返す"""
    await _register_and_login(client)
    resp = await client.post("/api/auth/fcm-token", json={"token": "test-token-abc"})
    assert resp.status_code == 204


async def test_register_fcm_token_duplicate(client: AsyncClient, db: AsyncSession) -> None:
    """同じトークンを2回登録しても 204 を返す（UNIQUE制約違反しない）"""
    await _register_and_login(client)
    await client.post("/api/auth/fcm-token", json={"token": "test-token-dup"})
    resp = await client.post("/api/auth/fcm-token", json={"token": "test-token-dup"})
    assert resp.status_code == 204


async def test_register_fcm_token_unauthenticated(client: AsyncClient) -> None:
    """未認証時は 401 を返す"""
    resp = await client.post("/api/auth/fcm-token", json={"token": "some-token"})
    assert resp.status_code == 401


# ─── send_push_to_home ────────────────────────────────────────────────────────


async def test_send_push_no_firebase(db: AsyncSession) -> None:
    """_firebase_appがNoneのときは何もしない（クラッシュしない）"""
    with patch.object(fcm_module, "_firebase_app", None):
        await fcm_module.send_push_to_home(db, 1, "タイトル", "本文")


async def test_send_push_sends_to_home_tokens(db: AsyncSession) -> None:
    """ホームメンバーのFCMトークンに送信する"""
    user = User(email="fcm@example.com", hashed_password="x", nickname="FCMテスト")
    db.add(user)
    await db.flush()

    home = Home(name="FCMテストホーム")
    db.add(home)
    await db.flush()

    db.add(HomeLink(user_id=user.id, home_id=home.id))
    db.add(FCMToken(user_id=user.id, token="real-token-123"))
    await db.flush()

    mock_resp = MagicMock(success=True)
    mock_batch = MagicMock(responses=[mock_resp])

    with (
        patch.object(fcm_module, "_firebase_app", MagicMock()),
        patch("firebase_admin.messaging.send_each", return_value=mock_batch) as mock_send,
    ):
        await fcm_module.send_push_to_home(db, home.id, "タイトル", "本文")
        mock_send.assert_called_once()
        messages = mock_send.call_args.args[0]
        assert len(messages) == 1
        assert messages[0].token == "real-token-123"


async def test_send_push_excludes_user(db: AsyncSession) -> None:
    """exclude_user_idのトークンは送信対象から除外する"""
    user1 = User(email="u1@example.com", hashed_password="x", nickname="ユーザー1")
    user2 = User(email="u2@example.com", hashed_password="x", nickname="ユーザー2")
    db.add_all([user1, user2])
    await db.flush()

    home = Home(name="除外テストホーム")
    db.add(home)
    await db.flush()

    db.add_all([
        HomeLink(user_id=user1.id, home_id=home.id),
        HomeLink(user_id=user2.id, home_id=home.id),
        FCMToken(user_id=user1.id, token="token-user1"),
        FCMToken(user_id=user2.id, token="token-user2"),
    ])
    await db.flush()

    mock_resp = MagicMock(success=True)
    mock_batch = MagicMock(responses=[mock_resp])

    with (
        patch.object(fcm_module, "_firebase_app", MagicMock()),
        patch("firebase_admin.messaging.send_each", return_value=mock_batch) as mock_send,
    ):
        await fcm_module.send_push_to_home(
            db, home.id, "タイトル", "本文", exclude_user_id=user1.id
        )
        messages = mock_send.call_args.args[0]
        assert len(messages) == 1
        assert messages[0].token == "token-user2"


async def test_send_push_warns_on_failure(
    db: AsyncSession, caplog: pytest.LogCaptureFixture
) -> None:
    """無効なトークンへの送信失敗時に WARNING を出してクラッシュしない"""
    user = User(email="warn@example.com", hashed_password="x", nickname="WARNテスト")
    db.add(user)
    await db.flush()

    home = Home(name="WARNテストホーム")
    db.add(home)
    await db.flush()

    db.add(HomeLink(user_id=user.id, home_id=home.id))
    db.add(FCMToken(user_id=user.id, token="invalid-token-xyz"))
    await db.flush()

    mock_failed = MagicMock(success=False, exception=Exception("invalid registration token"))
    mock_batch = MagicMock(responses=[mock_failed])

    with caplog.at_level(logging.WARNING, logger="app.utils.fcm"):
        with (
            patch.object(fcm_module, "_firebase_app", MagicMock()),
            patch("firebase_admin.messaging.send_each", return_value=mock_batch),
        ):
            await fcm_module.send_push_to_home(db, home.id, "タイトル", "本文")

    assert any("invalid-token-xyz" in r.message for r in caplog.records)


async def test_send_push_no_tokens(db: AsyncSession) -> None:
    """FCMトークンがないホームは Firebase を呼び出さない"""
    home = Home(name="トークンなしホーム")
    db.add(home)
    await db.flush()

    with (
        patch.object(fcm_module, "_firebase_app", MagicMock()),
        patch("firebase_admin.messaging.send_each") as mock_send,
    ):
        await fcm_module.send_push_to_home(db, home.id, "タイトル", "本文")
        mock_send.assert_not_called()


# ─── send_push_to_users ───────────────────────────────────────────────────────


async def test_send_push_to_users_sends_to_specified_users(db: AsyncSession) -> None:
    """指定したユーザーのFCMトークンにのみ送信する"""
    user1 = User(email="pu1@example.com", hashed_password="x", nickname="ユーザー1")
    user2 = User(email="pu2@example.com", hashed_password="x", nickname="ユーザー2")
    user3 = User(email="pu3@example.com", hashed_password="x", nickname="ユーザー3")
    db.add_all([user1, user2, user3])
    await db.flush()

    db.add_all([
        FCMToken(user_id=user1.id, token="token-pu1"),
        FCMToken(user_id=user2.id, token="token-pu2"),
        FCMToken(user_id=user3.id, token="token-pu3"),
    ])
    await db.flush()

    mock_resp = MagicMock(success=True)
    mock_batch = MagicMock(responses=[mock_resp, mock_resp])

    with (
        patch.object(fcm_module, "_firebase_app", MagicMock()),
        patch("firebase_admin.messaging.send_each", return_value=mock_batch) as mock_send,
    ):
        await fcm_module.send_push_to_users(
            db, [user1.id, user2.id], "タイトル", "本文"
        )
        messages = mock_send.call_args.args[0]
        tokens_sent = {m.token for m in messages}
        assert "token-pu1" in tokens_sent
        assert "token-pu2" in tokens_sent
        assert "token-pu3" not in tokens_sent


async def test_send_push_to_users_excludes_user(db: AsyncSession) -> None:
    """exclude_user_id は送信対象から除外される"""
    user1 = User(email="pex1@example.com", hashed_password="x", nickname="ユーザー1")
    user2 = User(email="pex2@example.com", hashed_password="x", nickname="ユーザー2")
    db.add_all([user1, user2])
    await db.flush()

    db.add_all([
        FCMToken(user_id=user1.id, token="token-pex1"),
        FCMToken(user_id=user2.id, token="token-pex2"),
    ])
    await db.flush()

    mock_resp = MagicMock(success=True)
    mock_batch = MagicMock(responses=[mock_resp])

    with (
        patch.object(fcm_module, "_firebase_app", MagicMock()),
        patch("firebase_admin.messaging.send_each", return_value=mock_batch) as mock_send,
    ):
        await fcm_module.send_push_to_users(
            db, [user1.id, user2.id], "タイトル", "本文", exclude_user_id=user1.id
        )
        messages = mock_send.call_args.args[0]
        assert len(messages) == 1
        assert messages[0].token == "token-pex2"


async def test_send_push_to_users_no_firebase(db: AsyncSession) -> None:
    """_firebase_appがNoneのときは何もしない"""
    with patch.object(fcm_module, "_firebase_app", None):
        await fcm_module.send_push_to_users(db, [1, 2], "タイトル", "本文")


async def test_send_push_to_users_empty_ids(db: AsyncSession) -> None:
    """空リストの場合は Firebase を呼び出さない"""
    with (
        patch.object(fcm_module, "_firebase_app", MagicMock()),
        patch("firebase_admin.messaging.send_each") as mock_send,
    ):
        await fcm_module.send_push_to_users(db, [], "タイトル", "本文")
        mock_send.assert_not_called()

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.home import Home, HomeLink
from app.utils.activity_logger import log_activity

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


async def _create_home_and_select(
    client: AsyncClient, db: AsyncSession, user_id: int
) -> int:
    home = Home(name="テストホーム")
    db.add(home)
    await db.flush()
    db.add(HomeLink(user_id=user_id, home_id=home.id))
    await db.flush()
    resp = await client.post(f"/api/auth/home-login/{home.id}")
    assert resp.status_code == 200
    return home.id


# ─── GET /api/activity/{home_id} ──────────────────────────────────────────────


async def test_get_activity_logs_empty(client: AsyncClient, db: AsyncSession) -> None:
    """アクティビティがない場合は空リストを返す"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)

    resp = await client.get(f"/api/activity/{home_id}")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_activity_logs(client: AsyncClient, db: AsyncSession) -> None:
    """ログが存在する場合に一覧を返す（target_type / is_read / nickname 含む）"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)

    await log_activity(db, home_id, user_id, "テストアクション", "test_model", 1)

    resp = await client.get(f"/api/activity/{home_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["action"] == "テストアクション"
    assert data[0]["target_type"] == "test_model"
    assert data[0]["target_id"] == 1
    assert data[0]["nickname"] == REGISTER_PAYLOAD["nickname"]
    assert data[0]["is_read"] is False


async def test_get_activity_logs_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """選択中ホーム以外のIDで 403 を返す"""
    user_id = await _register_and_login(client)
    await _create_home_and_select(client, db, user_id)

    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()

    resp = await client.get(f"/api/activity/{other_home.id}")
    assert resp.status_code == 403


async def test_get_activity_logs_is_read_after_mark(
    client: AsyncClient, db: AsyncSession
) -> None:
    """mark-as-read 後は is_read が True になる"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)

    await log_activity(db, home_id, user_id, "アクション", "test_model")

    before = (await client.get(f"/api/activity/{home_id}")).json()
    assert before[0]["is_read"] is False

    await client.post("/api/activity/mark-as-read")

    after = (await client.get(f"/api/activity/{home_id}")).json()
    assert after[0]["is_read"] is True


# ─── GET /api/activity/unread-count ───────────────────────────────────────────


async def test_unread_count_empty(client: AsyncClient, db: AsyncSession) -> None:
    """ログがない場合は 0 を返す"""
    user_id = await _register_and_login(client)
    await _create_home_and_select(client, db, user_id)

    resp = await client.get("/api/activity/unread-count")
    assert resp.status_code == 200
    assert resp.json()["count"] == 0


async def test_unread_count_with_logs(client: AsyncClient, db: AsyncSession) -> None:
    """未読ログがある場合にカウントを返す"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)

    await log_activity(db, home_id, user_id, "アクション1", "test_model")
    await log_activity(db, home_id, user_id, "アクション2", "test_model")

    resp = await client.get("/api/activity/unread-count")
    assert resp.status_code == 200
    assert resp.json()["count"] == 2


# ─── POST /api/activity/mark-as-read ──────────────────────────────────────────


async def test_mark_as_read(client: AsyncClient, db: AsyncSession) -> None:
    """既読にすると未読件数が 0 になる"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)

    await log_activity(db, home_id, user_id, "アクション", "test_model")

    resp = await client.post("/api/activity/mark-as-read")
    assert resp.status_code == 204

    count_resp = await client.get("/api/activity/unread-count")
    assert count_resp.json()["count"] == 0


async def test_mark_as_read_idempotent(client: AsyncClient, db: AsyncSession) -> None:
    """既読済みに再度 mark-as-read しても 204 を返す（UNIQUE制約違反しない）"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)

    await log_activity(db, home_id, user_id, "アクション", "test_model")

    await client.post("/api/activity/mark-as-read")
    resp = await client.post("/api/activity/mark-as-read")
    assert resp.status_code == 204


async def test_mark_as_read_no_logs(client: AsyncClient, db: AsyncSession) -> None:
    """ログがない場合も 204 を返す"""
    user_id = await _register_and_login(client)
    await _create_home_and_select(client, db, user_id)

    resp = await client.post("/api/activity/mark-as-read")
    assert resp.status_code == 204


# ─── 未読→既読の流れ ──────────────────────────────────────────────────────────


async def test_activity_full_flow(client: AsyncClient, db: AsyncSession) -> None:
    """ログ記録 → 未読確認 → 既読 → 未読0 の一連フローが動作する"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)

    await log_activity(db, home_id, user_id, "フロー確認", "test_model")

    count_before = (await client.get("/api/activity/unread-count")).json()["count"]
    assert count_before == 1

    logs = (await client.get(f"/api/activity/{home_id}")).json()
    assert logs[0]["action"] == "フロー確認"
    assert logs[0]["is_read"] is False

    await client.post("/api/activity/mark-as-read")

    count_after = (await client.get("/api/activity/unread-count")).json()["count"]
    assert count_after == 0

    logs_after = (await client.get(f"/api/activity/{home_id}")).json()
    assert logs_after[0]["is_read"] is True

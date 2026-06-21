from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.home import Home, HomeLink
from app.models.user import User
from app.utils.activity_logger import log_activity

REGISTER_PAYLOAD = {
    "email": "test@example.com",
    "password": "TestPass123!",
    "nickname": "テストユーザー",
}

_OTHER_EMAIL_SEQ = 0


def _other_email() -> str:
    global _OTHER_EMAIL_SEQ
    _OTHER_EMAIL_SEQ += 1
    return f"other{_OTHER_EMAIL_SEQ}@example.com"


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


async def _create_other_user(db: AsyncSession) -> int:
    """別ユーザーをDBに直接作成して user_id を返す。"""
    other = User(
        email=_other_email(),
        hashed_password="dummy",
        nickname="他のユーザー",
    )
    db.add(other)
    await db.flush()
    return other.id


# ─── GET /api/activity/{home_id} ──────────────────────────────────────────────


async def test_get_activity_logs_empty(client: AsyncClient, db: AsyncSession) -> None:
    """アクティビティがない場合は空リストを返す"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)

    resp = await client.get(f"/api/activity/{home_id}")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_activity_logs(client: AsyncClient, db: AsyncSession) -> None:
    """他ユーザーのログは一覧に表示される"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)
    other_id = await _create_other_user(db)

    await log_activity(db, home_id, other_id, "テストアクション", "test_model", 1)

    resp = await client.get(f"/api/activity/{home_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["action"] == "テストアクション"
    assert data[0]["target_type"] == "test_model"
    assert data[0]["target_id"] == 1
    assert data[0]["is_read"] is False


async def test_own_activity_not_visible(client: AsyncClient, db: AsyncSession) -> None:
    """自分の操作は一覧に表示されない（Issue #173）"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)

    await log_activity(db, home_id, user_id, "自分のアクション", "test_model", 1)

    resp = await client.get(f"/api/activity/{home_id}")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_system_activity_visible(client: AsyncClient, db: AsyncSession) -> None:
    """user_id=None のシステムログは表示される"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)

    await log_activity(db, home_id, None, "システムアクション", "test_model")

    resp = await client.get(f"/api/activity/{home_id}")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["action"] == "システムアクション"


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
    """mark-as-read 後は他ユーザーのログの is_read が True になる"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)
    other_id = await _create_other_user(db)

    await log_activity(db, home_id, other_id, "アクション", "test_model")

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


async def test_unread_count_with_other_user_logs(client: AsyncClient, db: AsyncSession) -> None:
    """他ユーザーの未読ログがある場合にカウントを返す"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)
    other_id = await _create_other_user(db)

    await log_activity(db, home_id, other_id, "アクション1", "test_model")
    await log_activity(db, home_id, other_id, "アクション2", "test_model")

    resp = await client.get("/api/activity/unread-count")
    assert resp.status_code == 200
    assert resp.json()["count"] == 2


async def test_own_activity_not_counted_as_unread(client: AsyncClient, db: AsyncSession) -> None:
    """自分の操作は未読カウントに含まれない（Issue #173）"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)

    await log_activity(db, home_id, user_id, "自分のアクション", "test_model")

    resp = await client.get("/api/activity/unread-count")
    assert resp.status_code == 200
    assert resp.json()["count"] == 0


async def test_unread_count_mixes_own_and_others(client: AsyncClient, db: AsyncSession) -> None:
    """自分と他ユーザー混在でも、未読カウントは他ユーザー分のみ"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)
    other_id = await _create_other_user(db)

    await log_activity(db, home_id, user_id, "自分のアクション", "test_model")
    await log_activity(db, home_id, other_id, "他人のアクション1", "test_model")
    await log_activity(db, home_id, other_id, "他人のアクション2", "test_model")

    resp = await client.get("/api/activity/unread-count")
    assert resp.json()["count"] == 2


# ─── POST /api/activity/mark-as-read ──────────────────────────────────────────


async def test_mark_as_read(client: AsyncClient, db: AsyncSession) -> None:
    """既読にすると未読件数が 0 になる"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)
    other_id = await _create_other_user(db)

    await log_activity(db, home_id, other_id, "アクション", "test_model")

    resp = await client.post("/api/activity/mark-as-read")
    assert resp.status_code == 204

    count_resp = await client.get("/api/activity/unread-count")
    assert count_resp.json()["count"] == 0


async def test_mark_as_read_idempotent(client: AsyncClient, db: AsyncSession) -> None:
    """既読済みに再度 mark-as-read しても 204 を返す（UNIQUE制約違反しない）"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)
    other_id = await _create_other_user(db)

    await log_activity(db, home_id, other_id, "アクション", "test_model")

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
    other_id = await _create_other_user(db)

    await log_activity(db, home_id, other_id, "フロー確認", "test_model")

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


# ─── POST /api/activity/{activity_id}/mark-as-read ────────────────────────────


async def test_mark_single_as_read(client: AsyncClient, db: AsyncSession) -> None:
    """1件だけ既読にすると、そのアイテムのみ is_read が True になる"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)
    other_id = await _create_other_user(db)

    await log_activity(db, home_id, other_id, "アクション1", "test_model")
    await log_activity(db, home_id, other_id, "アクション2", "test_model")

    logs = (await client.get(f"/api/activity/{home_id}")).json()
    assert len(logs) == 2
    target_id = logs[0]["id"]
    other_log_id = logs[1]["id"]

    resp = await client.post(f"/api/activity/{target_id}/mark-as-read")
    assert resp.status_code == 204

    logs_after = (await client.get(f"/api/activity/{home_id}")).json()
    by_id = {log["id"]: log for log in logs_after}
    assert by_id[target_id]["is_read"] is True
    assert by_id[other_log_id]["is_read"] is False

    count = (await client.get("/api/activity/unread-count")).json()["count"]
    assert count == 1


async def test_mark_single_as_read_idempotent(client: AsyncClient, db: AsyncSession) -> None:
    """同じアイテムを2回既読化しても 204 を返す（UNIQUE制約違反しない）"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)
    other_id = await _create_other_user(db)

    await log_activity(db, home_id, other_id, "アクション", "test_model")
    logs = (await client.get(f"/api/activity/{home_id}")).json()
    activity_id = logs[0]["id"]

    await client.post(f"/api/activity/{activity_id}/mark-as-read")
    resp = await client.post(f"/api/activity/{activity_id}/mark-as-read")
    assert resp.status_code == 204


async def test_mark_single_as_read_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他のホームのアクティビティIDを指定しても 204 を返し、既読化されない"""
    user_id = await _register_and_login(client)
    home_id = await _create_home_and_select(client, db, user_id)
    other_id = await _create_other_user(db)

    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    await log_activity(db, other_home.id, other_id, "アクション", "test_model")

    all_logs_resp = await client.get(f"/api/activity/{home_id}")
    assert all_logs_resp.status_code == 200
    assert all_logs_resp.json() == []

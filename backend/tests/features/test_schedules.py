from datetime import UTC, datetime

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityLog
from app.models.home import Home
from app.models.schedule import Schedule

_SEQ = 0


def _unique_email() -> str:
    global _SEQ
    _SEQ += 1
    return f"schedule_user{_SEQ}@example.com"


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


_DEFAULT_SCHEDULE = {
    "title": "テストスケジュール",
    "memo": "メモ内容",
    "start_day": "2099-01-01T10:00:00+00:00",
    "end_day": "2099-01-01T12:00:00+00:00",
}


# ─── GET /api/schedules/{home_id} ─────────────────────────────────────────────


async def test_list_schedules_empty(client: AsyncClient) -> None:
    """スケジュールがない場合は空リストを返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.get(f"/api/schedules/{home_id}")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_schedules(client: AsyncClient) -> None:
    """スケジュール一覧を返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/schedules", json=_DEFAULT_SCHEDULE)
    resp = await client.get(f"/api/schedules/{home_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "テストスケジュール"
    assert data[0]["memo"] == "メモ内容"


async def test_list_schedules_start_filter(client: AsyncClient) -> None:
    """start パラメータで範囲フィルターできる（end_day >= start の絞り込み）"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post(
        "/api/schedules",
        json={**_DEFAULT_SCHEDULE, "start_day": "2099-01-01T00:00:00+00:00",
              "end_day": "2099-01-01T23:59:59+00:00"},
    )
    await client.post(
        "/api/schedules",
        json={**_DEFAULT_SCHEDULE, "title": "先月のスケジュール",
              "start_day": "2098-12-01T00:00:00+00:00",
              "end_day": "2098-12-31T23:59:59+00:00"},
    )
    resp = await client.get(f"/api/schedules/{home_id}", params={"start": "2099-01-01"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "テストスケジュール"


async def test_list_schedules_end_filter(client: AsyncClient) -> None:
    """end パラメータで範囲フィルターできる（start_day <= end の絞り込み）"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post(
        "/api/schedules",
        json={**_DEFAULT_SCHEDULE, "start_day": "2099-01-01T00:00:00+00:00",
              "end_day": "2099-01-01T23:59:59+00:00"},
    )
    await client.post(
        "/api/schedules",
        json={**_DEFAULT_SCHEDULE, "title": "来月のスケジュール",
              "start_day": "2099-02-01T00:00:00+00:00",
              "end_day": "2099-02-28T23:59:59+00:00"},
    )
    resp = await client.get(f"/api/schedules/{home_id}", params={"end": "2099-01-31"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "テストスケジュール"


async def test_list_schedules_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームのスケジュール一覧は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    resp = await client.get(f"/api/schedules/{other_home.id}")
    assert resp.status_code == 403


# ─── POST /api/schedules ──────────────────────────────────────────────────────


async def test_create_schedule(client: AsyncClient) -> None:
    """スケジュールを作成すると 201 と作成データを返す"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    resp = await client.post("/api/schedules", json=_DEFAULT_SCHEDULE)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "テストスケジュール"
    assert data["memo"] == "メモ内容"
    assert "id" in data
    assert "home_id" in data


async def test_create_schedule_empty_memo(client: AsyncClient) -> None:
    """memoは省略可能（デフォルト空文字）"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    payload = {
        "title": "メモなし",
        "start_day": "2099-01-01T10:00:00+00:00",
        "end_day": "2099-01-01T12:00:00+00:00",
    }
    resp = await client.post("/api/schedules", json=payload)
    assert resp.status_code == 201
    assert resp.json()["memo"] == ""


async def test_create_schedule_unauthenticated(client: AsyncClient) -> None:
    """未認証時は 401 を返す"""
    resp = await client.post("/api/schedules", json=_DEFAULT_SCHEDULE)
    assert resp.status_code == 401


# ─── GET /api/schedules/{id}/detail ──────────────────────────────────────────


async def test_get_schedule_detail(client: AsyncClient) -> None:
    """スケジュール詳細を取得できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/schedules", json=_DEFAULT_SCHEDULE)
    schedule_id = create_resp.json()["id"]
    resp = await client.get(f"/api/schedules/{schedule_id}/detail")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "テストスケジュール"
    assert data["id"] == schedule_id


async def test_get_schedule_detail_wrong_home(
    client: AsyncClient, db: AsyncSession
) -> None:
    """他ホームのスケジュール詳細は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    schedule = Schedule(
        home_id=other_home.id,
        title="他のスケジュール",
        memo="",
        start_day=datetime(2099, 1, 1, 10, 0, 0, tzinfo=UTC),
        end_day=datetime(2099, 1, 1, 12, 0, 0, tzinfo=UTC),
    )
    db.add(schedule)
    await db.flush()
    resp = await client.get(f"/api/schedules/{schedule.id}/detail")
    assert resp.status_code == 403


# ─── PUT /api/schedules/{id} ──────────────────────────────────────────────────


async def test_update_schedule(client: AsyncClient) -> None:
    """スケジュールを更新できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/schedules", json=_DEFAULT_SCHEDULE)
    schedule_id = create_resp.json()["id"]
    resp = await client.put(
        f"/api/schedules/{schedule_id}",
        json={**_DEFAULT_SCHEDULE, "title": "更新後タイトル"},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "更新後タイトル"


async def test_update_schedule_wrong_home(
    client: AsyncClient, db: AsyncSession
) -> None:
    """他ホームのスケジュール更新は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    schedule = Schedule(
        home_id=other_home.id,
        title="他のスケジュール",
        memo="",
        start_day=datetime(2099, 1, 1, 10, 0, 0, tzinfo=UTC),
        end_day=datetime(2099, 1, 1, 12, 0, 0, tzinfo=UTC),
    )
    db.add(schedule)
    await db.flush()
    resp = await client.put(
        f"/api/schedules/{schedule.id}",
        json={**_DEFAULT_SCHEDULE, "title": "変更試み"},
    )
    assert resp.status_code == 403


# ─── DELETE /api/schedules/{id} ───────────────────────────────────────────────


async def test_delete_schedule(client: AsyncClient) -> None:
    """スケジュールを削除すると 204 を返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post("/api/schedules", json=_DEFAULT_SCHEDULE)
    schedule_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/schedules/{schedule_id}")
    assert resp.status_code == 204
    list_resp = await client.get(f"/api/schedules/{home_id}")
    assert list_resp.json() == []


async def test_delete_schedule_wrong_home(
    client: AsyncClient, db: AsyncSession
) -> None:
    """他ホームのスケジュール削除は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    schedule = Schedule(
        home_id=other_home.id,
        title="他のスケジュール",
        memo="",
        start_day=datetime(2099, 1, 1, 10, 0, 0, tzinfo=UTC),
        end_day=datetime(2099, 1, 1, 12, 0, 0, tzinfo=UTC),
    )
    db.add(schedule)
    await db.flush()
    resp = await client.delete(f"/api/schedules/{schedule.id}")
    assert resp.status_code == 403


# ─── アクティビティログ検証 ────────────────────────────────────────────────────


async def test_activity_log_on_create(client: AsyncClient, db: AsyncSession) -> None:
    """スケジュール作成でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/schedules", json=_DEFAULT_SCHEDULE)
    result = await db.execute(select(ActivityLog).where(ActivityLog.home_id == home_id))
    logs = result.scalars().all()
    assert any("作成" in log.action for log in logs)


async def test_activity_log_on_update(client: AsyncClient, db: AsyncSession) -> None:
    """スケジュール更新でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post("/api/schedules", json=_DEFAULT_SCHEDULE)
    schedule_id = create_resp.json()["id"]
    await client.put(
        f"/api/schedules/{schedule_id}",
        json={**_DEFAULT_SCHEDULE, "title": "更新"},
    )
    result = await db.execute(select(ActivityLog).where(ActivityLog.home_id == home_id))
    logs = result.scalars().all()
    assert any("更新" in log.action for log in logs)


async def test_activity_log_on_delete(client: AsyncClient, db: AsyncSession) -> None:
    """スケジュール削除でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post("/api/schedules", json=_DEFAULT_SCHEDULE)
    schedule_id = create_resp.json()["id"]
    await client.delete(f"/api/schedules/{schedule_id}")
    result = await db.execute(select(ActivityLog).where(ActivityLog.home_id == home_id))
    logs = result.scalars().all()
    assert any("削除" in log.action for log in logs)

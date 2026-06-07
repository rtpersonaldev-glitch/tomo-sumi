from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.home import Home
from app.models.todo import Todo

_SEQ = 0


def _unique_email() -> str:
    global _SEQ
    _SEQ += 1
    return f"todo_user{_SEQ}@example.com"


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


_DEFAULT_TODO = {
    "title": "テストTODO",
    "complete_flag": False,
    "contents": [
        {"content": "項目1", "check_flag": False},
        {"content": "項目2", "check_flag": False},
    ],
}


# ─── GET /api/todos/{home_id} ──────────────────────────────────────────────────


async def test_list_todos_empty(client: AsyncClient) -> None:
    """TODOリストがない場合は空リストを返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.get(f"/api/todos/{home_id}")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_todos(client: AsyncClient) -> None:
    """TODOリスト一覧を返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/todos", json=_DEFAULT_TODO)
    resp = await client.get(f"/api/todos/{home_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "テストTODO"
    assert len(data[0]["contents"]) == 2


async def test_list_todos_search(client: AsyncClient) -> None:
    """search パラメータでタイトル検索できる"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/todos", json={**_DEFAULT_TODO, "title": "買い物リスト"})
    await client.post("/api/todos", json={**_DEFAULT_TODO, "title": "掃除タスク"})
    resp = await client.get(f"/api/todos/{home_id}", params={"search": "買い物"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "買い物リスト"


async def test_list_todos_ordering(client: AsyncClient) -> None:
    """ordering=title でタイトル昇順ソートできる"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/todos", json={**_DEFAULT_TODO, "title": "B タスク"})
    await client.post("/api/todos", json={**_DEFAULT_TODO, "title": "A タスク"})
    resp = await client.get(f"/api/todos/{home_id}", params={"ordering": "title"})
    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["title"] == "A タスク"
    assert data[1]["title"] == "B タスク"


async def test_list_todos_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームのTODO一覧は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    resp = await client.get(f"/api/todos/{other_home.id}")
    assert resp.status_code == 403


# ─── POST /api/todos ───────────────────────────────────────────────────────────


async def test_create_todo(client: AsyncClient) -> None:
    """TODOリストを作成すると 201 と作成データを返す"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    resp = await client.post("/api/todos", json=_DEFAULT_TODO)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "テストTODO"
    assert data["complete_flag"] is False
    assert len(data["contents"]) == 2
    assert data["contents"][0]["content"] == "項目1"


async def test_create_todo_no_contents(client: AsyncClient) -> None:
    """contentsなしでもTODOリストを作成できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    resp = await client.post("/api/todos", json={"title": "空のTODO", "complete_flag": False})
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "空のTODO"
    assert data["contents"] == []


async def test_create_todo_unauthenticated(client: AsyncClient) -> None:
    """未認証時は 401 を返す"""
    resp = await client.post("/api/todos", json=_DEFAULT_TODO)
    assert resp.status_code == 401


# ─── GET /api/todos/{id}/detail ───────────────────────────────────────────────


async def test_get_todo_detail(client: AsyncClient) -> None:
    """TODOリスト詳細（contents含む）を取得できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/todos", json=_DEFAULT_TODO)
    todo_id = create_resp.json()["id"]
    resp = await client.get(f"/api/todos/{todo_id}/detail")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "テストTODO"
    assert len(data["contents"]) == 2


async def test_get_todo_detail_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームのTODO詳細は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    todo = Todo(home_id=other_home.id, title="他のTODO", complete_flag=False)
    db.add(todo)
    await db.flush()
    resp = await client.get(f"/api/todos/{todo.id}/detail")
    assert resp.status_code == 403


# ─── PUT /api/todos/{id} ──────────────────────────────────────────────────────


async def test_update_todo(client: AsyncClient) -> None:
    """TODOリストを更新できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/todos", json=_DEFAULT_TODO)
    todo_id = create_resp.json()["id"]
    resp = await client.put(
        f"/api/todos/{todo_id}",
        json={
            "title": "更新後タイトル",
            "complete_flag": True,
            "contents": [{"content": "新しい項目", "check_flag": True}],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "更新後タイトル"
    assert data["complete_flag"] is True
    assert len(data["contents"]) == 1
    assert data["contents"][0]["content"] == "新しい項目"
    assert data["contents"][0]["check_flag"] is True


async def test_update_todo_clears_old_contents(client: AsyncClient) -> None:
    """更新時に古いcontentsは削除され新しいものに置き換わる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/todos", json=_DEFAULT_TODO)
    todo_id = create_resp.json()["id"]
    resp = await client.put(
        f"/api/todos/{todo_id}",
        json={"title": "更新", "complete_flag": False, "contents": []},
    )
    assert resp.status_code == 200
    assert resp.json()["contents"] == []


async def test_update_todo_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームのTODO更新は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    todo = Todo(home_id=other_home.id, title="他のTODO", complete_flag=False)
    db.add(todo)
    await db.flush()
    resp = await client.put(
        f"/api/todos/{todo.id}",
        json={"title": "変更試み", "complete_flag": False, "contents": []},
    )
    assert resp.status_code == 403


# ─── DELETE /api/todos/{id} ───────────────────────────────────────────────────


async def test_delete_todo(client: AsyncClient) -> None:
    """TODOリストを削除すると 204 を返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post("/api/todos", json=_DEFAULT_TODO)
    todo_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/todos/{todo_id}")
    assert resp.status_code == 204
    list_resp = await client.get(f"/api/todos/{home_id}")
    assert list_resp.json() == []


async def test_delete_todo_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームのTODO削除は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    todo = Todo(home_id=other_home.id, title="他のTODO", complete_flag=False)
    db.add(todo)
    await db.flush()
    resp = await client.delete(f"/api/todos/{todo.id}")
    assert resp.status_code == 403


# ─── アクティビティログ検証 ────────────────────────────────────────────────────


async def test_activity_log_on_create(client: AsyncClient) -> None:
    """TODO作成でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/todos", json=_DEFAULT_TODO)
    logs_resp = await client.get(f"/api/activity/{home_id}")
    logs = logs_resp.json()
    assert any("作成" in log["action"] for log in logs)


async def test_activity_log_on_update(client: AsyncClient) -> None:
    """TODO更新でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post("/api/todos", json=_DEFAULT_TODO)
    todo_id = create_resp.json()["id"]
    await client.put(
        f"/api/todos/{todo_id}",
        json={"title": "更新", "complete_flag": False, "contents": []},
    )
    logs_resp = await client.get(f"/api/activity/{home_id}")
    logs = logs_resp.json()
    assert any("更新" in log["action"] for log in logs)


async def test_activity_log_on_delete(client: AsyncClient) -> None:
    """TODO削除でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post("/api/todos", json=_DEFAULT_TODO)
    todo_id = create_resp.json()["id"]
    await client.delete(f"/api/todos/{todo_id}")
    logs_resp = await client.get(f"/api/activity/{home_id}")
    logs = logs_resp.json()
    assert any("削除" in log["action"] for log in logs)

from fastapi import HTTPException
from sqlalchemy import asc, desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.features.todos.schemas import TodoContentRequest, TodoResponse
from app.models.todo import Todo, TodoContent
from app.utils.activity_logger import log_activity


class TodoService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get_or_403(self, todo_id: int, home_id: int) -> Todo:
        result = await self.db.execute(
            select(Todo).options(joinedload(Todo.contents)).where(Todo.id == todo_id)
        )
        todo = result.scalars().unique().one_or_none()
        if not todo:
            raise HTTPException(status_code=404, detail="TODOリストが見つかりません")
        if todo.home_id != home_id:
            raise HTTPException(status_code=403, detail="このTODOへのアクセス権限がありません")
        return todo

    async def list_todos(
        self,
        home_id: int,
        current_home_id: int,
        search: str | None = None,
        ordering: str | None = None,
    ) -> list[TodoResponse]:
        if home_id != current_home_id:
            raise HTTPException(status_code=403, detail="現在選択中のホームのみ参照できます")
        query = (
            select(Todo)
            .options(joinedload(Todo.contents))
            .where(Todo.home_id == home_id)
        )
        if search:
            query = query.where(Todo.title.ilike(f"%{search}%"))
        if ordering == "created_at":
            query = query.order_by(asc(Todo.created_at))
        elif ordering == "title":
            query = query.order_by(asc(Todo.title))
        elif ordering == "-title":
            query = query.order_by(desc(Todo.title))
        else:
            query = query.order_by(desc(Todo.created_at))
        result = await self.db.execute(query)
        todos = list(result.scalars().unique().all())
        return [TodoResponse.model_validate(t) for t in todos]

    async def create_todo(
        self,
        home_id: int,
        user_id: int,
        title: str,
        complete_flag: bool,
        contents: list[TodoContentRequest],
    ) -> TodoResponse:
        todo = Todo(
            home_id=home_id,
            title=title,
            complete_flag=complete_flag,
            created_by=user_id,
        )
        self.db.add(todo)
        await self.db.flush()
        for item in contents:
            self.db.add(
                TodoContent(todo_id=todo.id, content=item.content, check_flag=item.check_flag)
            )
        await self.db.flush()
        result = await self.db.execute(
            select(Todo).options(joinedload(Todo.contents)).where(Todo.id == todo.id)
        )
        todo = result.scalars().unique().one()
        await log_activity(self.db, home_id, user_id, "TODOリストを作成しました", "todo", todo.id)
        return TodoResponse.model_validate(todo)

    async def get_todo(self, todo_id: int, home_id: int) -> TodoResponse:
        todo = await self._get_or_403(todo_id, home_id)
        return TodoResponse.model_validate(todo)

    async def update_todo(
        self,
        todo_id: int,
        home_id: int,
        user_id: int,
        title: str,
        complete_flag: bool,
        contents: list[TodoContentRequest],
    ) -> TodoResponse:
        todo = await self._get_or_403(todo_id, home_id)
        todo.title = title
        todo.complete_flag = complete_flag
        todo.updated_by = user_id
        for existing in list(todo.contents):
            await self.db.delete(existing)
        await self.db.flush()
        self.db.expire(todo)  # clear stale contents cache after delete
        for item in contents:
            self.db.add(
                TodoContent(todo_id=todo_id, content=item.content, check_flag=item.check_flag)
            )
        await self.db.flush()
        result = await self.db.execute(
            select(Todo).options(joinedload(Todo.contents)).where(Todo.id == todo_id)
        )
        todo = result.scalars().unique().one()
        await log_activity(self.db, home_id, user_id, "TODOリストを更新しました", "todo", todo_id)
        return TodoResponse.model_validate(todo)

    async def delete_todo(self, todo_id: int, home_id: int, user_id: int) -> None:
        todo = await self._get_or_403(todo_id, home_id)
        for content in todo.contents:
            await self.db.delete(content)
        await self.db.flush()
        await self.db.delete(todo)
        await log_activity(self.db, home_id, user_id, "TODOリストを削除しました", "todo", todo_id)
        await self.db.flush()

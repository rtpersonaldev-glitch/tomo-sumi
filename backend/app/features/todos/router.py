from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_home, get_current_user
from app.features.todos.schemas import TodoCreateRequest, TodoResponse, TodoUpdateRequest
from app.features.todos.service import TodoService
from app.models.home import Home
from app.models.user import User

router = APIRouter()


@router.post("", response_model=TodoResponse, status_code=201)
async def create_todo(
    body: TodoCreateRequest,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TodoResponse:
    return await TodoService(db).create_todo(
        home_id=current_home.id,
        user_id=current_user.id,
        title=body.title,
        complete_flag=body.complete_flag,
        contents=body.contents,
    )


@router.get("/{home_id}", response_model=list[TodoResponse])
async def list_todos(
    home_id: int,
    search: str | None = None,
    ordering: str | None = None,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TodoResponse]:
    return await TodoService(db).list_todos(
        home_id=home_id,
        current_home_id=current_home.id,
        search=search,
        ordering=ordering,
    )


@router.get("/{todo_id}/detail", response_model=TodoResponse)
async def get_todo(
    todo_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TodoResponse:
    return await TodoService(db).get_todo(
        todo_id=todo_id,
        home_id=current_home.id,
    )


@router.put("/{todo_id}", response_model=TodoResponse)
async def update_todo(
    todo_id: int,
    body: TodoUpdateRequest,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TodoResponse:
    return await TodoService(db).update_todo(
        todo_id=todo_id,
        home_id=current_home.id,
        user_id=current_user.id,
        title=body.title,
        complete_flag=body.complete_flag,
        contents=body.contents,
    )


@router.delete("/{todo_id}", status_code=204)
async def delete_todo(
    todo_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await TodoService(db).delete_todo(
        todo_id=todo_id,
        home_id=current_home.id,
        user_id=current_user.id,
    )

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_home, get_current_user
from app.core.security import verify_token
from app.features.chat.connection_manager import manager
from app.features.chat.schemas import ChatImageUploadResponse, ChatMessageResponse
from app.features.chat.service import ChatService
from app.models.home import Home
from app.models.user import User
from app.utils.file_storage import save_image

router = APIRouter()


def _get_token_from_websocket(websocket: WebSocket) -> str:
    token = websocket.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return token


@router.get("/{home_id}/messages", response_model=list[ChatMessageResponse])
async def get_chat_history(
    home_id: int,
    limit: int = 50,
    before_id: int | None = None,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChatMessageResponse]:
    return await ChatService(db).get_history(
        home_id=home_id,
        current_home_id=current_home.id,
        limit=limit,
        before_id=before_id,
    )


@router.post("/{home_id}/images", response_model=ChatImageUploadResponse)
async def upload_chat_image(
    home_id: int,
    image: UploadFile = File(...),
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
) -> ChatImageUploadResponse:
    if home_id != current_home.id:
        raise HTTPException(status_code=403, detail="現在選択中のホームのみ操作できます")
    path = await save_image(image, directory="chat_pictures", max_mb=10)
    return ChatImageUploadResponse(image_path=path)


@router.websocket("/ws/{home_id}")
async def chat_websocket(
    home_id: int,
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db),
) -> None:
    try:
        token = _get_token_from_websocket(websocket)
        payload = verify_token(token)
        user_id = int(payload["sub"])
        token_home_id = payload.get("home_id")
    except HTTPException:
        await websocket.close(code=4001)
        return

    if token_home_id != home_id:
        await websocket.close(code=4003)
        return

    await manager.connect(home_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "message":
                saved = await ChatService(db).save_message(
                    home_id=home_id,
                    user_id=user_id,
                    message=data.get("message", ""),
                )
                await manager.broadcast(home_id, saved)

            elif msg_type == "image":
                saved = await ChatService(db).save_image_message(
                    home_id=home_id,
                    user_id=user_id,
                    image_path=data.get("image_path", ""),
                )
                await manager.broadcast(home_id, saved)

            elif msg_type == "read":
                await ChatService(db).mark_as_read(home_id=home_id, user_id=user_id)

    except WebSocketDisconnect:
        manager.disconnect(home_id, websocket)

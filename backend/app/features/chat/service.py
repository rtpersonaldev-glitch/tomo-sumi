from fastapi import HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.features.chat.schemas import ChatMessageResponse
from app.models.chat import ChatMessage, ChatPicture, ChatRead
from app.models.user import User
from app.utils.fcm import send_push_to_home
from app.utils.file_storage import get_media_url


class ChatService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def save_message(self, home_id: int, user_id: int, message: str) -> dict:
        user = await self.db.get(User, user_id)
        msg = ChatMessage(home_id=home_id, user_id=user_id, message=message)
        self.db.add(msg)
        await self.db.flush()
        await self.db.refresh(msg)

        nickname = user.nickname if user else "メンバー"
        await send_push_to_home(
            self.db,
            home_id=home_id,
            title=nickname,
            body=message[:100] if message else "メッセージを送信しました",
            exclude_user_id=user_id,
        )

        return {
            "id": msg.id,
            "type": "message",
            "message": msg.message,
            "image_url": None,
            "user_id": user_id,
            "nickname": nickname,
            "icon_url": get_media_url(user.icon_path if user else None, settings.MEDIA_BASE_URL),
            "timestamp": msg.created_at.isoformat(),
        }

    async def save_image_message(self, home_id: int, user_id: int, image_path: str) -> dict:
        user = await self.db.get(User, user_id)
        msg = ChatMessage(home_id=home_id, user_id=user_id, message="")
        self.db.add(msg)
        await self.db.flush()

        pic = ChatPicture(message_id=msg.id, image_path=image_path)
        self.db.add(pic)
        await self.db.flush()
        await self.db.refresh(msg)

        nickname = user.nickname if user else "メンバー"
        await send_push_to_home(
            self.db,
            home_id=home_id,
            title=nickname,
            body="画像を送信しました",
            exclude_user_id=user_id,
        )

        return {
            "id": msg.id,
            "type": "image",
            "message": None,
            "image_url": get_media_url(image_path, settings.MEDIA_BASE_URL),
            "user_id": user_id,
            "nickname": nickname,
            "icon_url": get_media_url(user.icon_path if user else None, settings.MEDIA_BASE_URL),
            "timestamp": msg.created_at.isoformat(),
        }

    async def get_history(
        self,
        home_id: int,
        current_home_id: int,
        limit: int = 50,
        before_id: int | None = None,
    ) -> list[ChatMessageResponse]:
        if home_id != current_home_id:
            raise HTTPException(status_code=403, detail="現在選択中のホームのみ参照できます")

        query = (
            select(ChatMessage)
            .options(joinedload(ChatMessage.pictures))
            .where(ChatMessage.home_id == home_id)
            .order_by(desc(ChatMessage.id))
            .limit(limit)
        )
        if before_id is not None:
            query = query.where(ChatMessage.id < before_id)

        result = await self.db.execute(query)
        messages = list(reversed(result.scalars().unique().all()))

        responses = []
        for msg in messages:
            user = await self.db.get(User, msg.user_id)
            if msg.pictures:
                msg_type = "image"
                image_url = get_media_url(msg.pictures[0].image_path, settings.MEDIA_BASE_URL)
                message_text = None
            else:
                msg_type = "message"
                image_url = None
                message_text = msg.message or None

            responses.append(
                ChatMessageResponse(
                    id=msg.id,
                    type=msg_type,
                    message=message_text,
                    image_url=image_url,
                    user_id=msg.user_id,
                    nickname=user.nickname if user else "",
                    icon_url=get_media_url(
                        user.icon_path if user else None, settings.MEDIA_BASE_URL
                    ),
                    timestamp=msg.created_at,
                )
            )
        return responses

    async def mark_as_read(self, home_id: int, user_id: int) -> None:
        msgs_result = await self.db.execute(
            select(ChatMessage.id).where(ChatMessage.home_id == home_id)
        )
        all_msg_ids = [row[0] for row in msgs_result.all()]
        if not all_msg_ids:
            return

        reads_result = await self.db.execute(
            select(ChatRead.message_id).where(
                ChatRead.user_id == user_id,
                ChatRead.message_id.in_(all_msg_ids),
            )
        )
        read_ids = {row[0] for row in reads_result.all()}

        for msg_id in all_msg_ids:
            if msg_id not in read_ids:
                self.db.add(ChatRead(message_id=msg_id, user_id=user_id))

        await self.db.flush()

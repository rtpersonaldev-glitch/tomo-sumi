# WebSocket認証・チャットプロトコル

## WebSocket認証の設計方針

HTTPonly CookieはWebSocket接続時にもブラウザが自動送信する。ただし、FastAPIのWebSocketエンドポイントで `Cookie()` 依存関係を使うにはリクエストオブジェクトから手動でCookieを取得する必要がある。

**採用方式：接続時にCookieからJWTを検証する**

```
クライアント                       サーバー
    |                                  |
    |--- WS接続（Cookie: access_token）→ |
    |                                  | JWT検証
    |                                  | home_idを確認
    |                                  | ConnectionManagerに登録
    |←───── 接続確立 ─────────────────── |
    |                                  |
    |--- {"type": "message", ...} ───→ |
    |                                  | DBに保存
    |                                  | home内全接続にbroadcast
    |←───── {"id": 1, ...} ─────────── |（自分も含む）
```

---

## バックエンド実装

### 接続管理（app/features/chat/connection_manager.py）

```python
from collections import defaultdict
from fastapi import WebSocket


class ChatConnectionManager:
    def __init__(self) -> None:
        # home_id → [WebSocket, ...] のマッピング
        self._connections: dict[int, list[WebSocket]] = defaultdict(list)

    async def connect(self, home_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[home_id].append(websocket)

    def disconnect(self, home_id: int, websocket: WebSocket) -> None:
        conns = self._connections.get(home_id, [])
        if websocket in conns:
            conns.remove(websocket)

    async def broadcast(self, home_id: int, message: dict) -> None:
        """ホーム内の全接続にJSONメッセージを送信"""
        disconnected = []
        for ws in self._connections.get(home_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(ws)
        # 切断済みの接続をクリーンアップ
        for ws in disconnected:
            self.disconnect(home_id, ws)


manager = ChatConnectionManager()
```

### WebSocketエンドポイント（app/features/chat/router.py）

```python
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import verify_token
from app.features.chat.connection_manager import manager
from app.features.chat.service import ChatService
from app.features.chat.schemas import ChatMessageResponse

router = APIRouter()


def _get_token_from_websocket(websocket: WebSocket) -> str:
    """WebSocketのCookieからaccess_tokenを取得"""
    cookies = websocket.cookies
    token = cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return token


@router.websocket("/ws/{home_id}")
async def chat_websocket(
    home_id: int,
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db),
) -> None:
    # 接続時にJWT検証
    try:
        token = _get_token_from_websocket(websocket)
        payload = verify_token(token)
        user_id = int(payload["sub"])
        token_home_id = payload.get("home_id")
    except HTTPException:
        await websocket.close(code=4001)  # 4001: 認証エラー
        return

    # JWTのhome_idと接続先home_idが一致するか確認
    if token_home_id != home_id:
        await websocket.close(code=4003)  # 4003: 権限エラー
        return

    await manager.connect(home_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "message":
                # テキストメッセージをDBに保存してbroadcast
                saved = await ChatService(db).save_message(
                    home_id=home_id,
                    user_id=user_id,
                    message=data.get("message", ""),
                )
                await manager.broadcast(home_id, saved)

            elif msg_type == "image":
                # 画像メッセージ（画像はREST APIで先に送信してパスを取得しておく）
                saved = await ChatService(db).save_image_message(
                    home_id=home_id,
                    user_id=user_id,
                    image_path=data.get("image_path", ""),
                )
                await manager.broadcast(home_id, saved)

            elif msg_type == "read":
                # 既読通知
                await ChatService(db).mark_as_read(home_id=home_id, user_id=user_id)

    except WebSocketDisconnect:
        manager.disconnect(home_id, websocket)
```

### チャットサービス（app/features/chat/service.py）

```python
from datetime import datetime, timezone
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatMessage, ChatRead
from app.models.user import User
from app.core.config import settings
from app.utils.file_storage import get_media_url


class ChatService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def save_message(
        self, home_id: int, user_id: int, message: str
    ) -> dict:
        user = await self.db.get(User, user_id)
        msg = ChatMessage(
            home_id=home_id,
            user_id=user_id,
            message=message,
            message_type="text",
        )
        self.db.add(msg)
        await self.db.flush()

        return {
            "id": msg.id,
            "type": "message",
            "message": msg.message,
            "user_id": user_id,
            "nickname": user.nickname if user else "",
            "icon_url": get_media_url(user.icon_path if user else None, settings.MEDIA_BASE_URL),
            "timestamp": msg.created_at.isoformat(),
        }

    async def save_image_message(
        self, home_id: int, user_id: int, image_path: str
    ) -> dict:
        user = await self.db.get(User, user_id)
        msg = ChatMessage(
            home_id=home_id,
            user_id=user_id,
            image_path=image_path,
            message_type="image",
        )
        self.db.add(msg)
        await self.db.flush()

        return {
            "id": msg.id,
            "type": "image",
            "image_url": get_media_url(image_path, settings.MEDIA_BASE_URL),
            "user_id": user_id,
            "nickname": user.nickname if user else "",
            "icon_url": get_media_url(user.icon_path if user else None, settings.MEDIA_BASE_URL),
            "timestamp": msg.created_at.isoformat(),
        }

    async def get_history(
        self, home_id: int, limit: int = 50, before_id: int | None = None
    ) -> list[ChatMessage]:
        query = (
            select(ChatMessage)
            .where(ChatMessage.home_id == home_id)
            .order_by(desc(ChatMessage.created_at))
            .limit(limit)
        )
        if before_id:
            query = query.where(ChatMessage.id < before_id)
        result = await self.db.execute(query)
        messages = result.scalars().all()
        return list(reversed(messages))  # 古い順に並び替えて返す

    async def mark_as_read(self, home_id: int, user_id: int) -> None:
        read = await self.db.execute(
            select(ChatRead).where(
                ChatRead.home_id == home_id, ChatRead.user_id == user_id
            )
        )
        chat_read = read.scalar_one_or_none()
        if chat_read:
            chat_read.last_read_at = datetime.now(timezone.utc)
        else:
            self.db.add(ChatRead(home_id=home_id, user_id=user_id))
```

### チャット履歴RESTエンドポイント（同 router.py）

```python
@router.get("/{home_id}/messages", response_model=list[ChatMessageResponse])
async def get_chat_history(
    home_id: int,
    limit: int = 50,
    before_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """チャット履歴（カーソルベースページネーション）"""
    return await ChatService(db).get_history(home_id, limit, before_id)
```

---

## WebSocketメッセージプロトコル

### クライアント → サーバー

#### テキストメッセージ送信

```json
{
  "type": "message",
  "message": "こんにちは！"
}
```

#### 既読通知

```json
{
  "type": "read"
}
```

### サーバー → クライアント（broadcast）

#### テキストメッセージ受信

```json
{
  "id": 123,
  "type": "message",
  "message": "こんにちは！",
  "user_id": 42,
  "nickname": "田中",
  "icon_url": "https://yourdomain.com/media/icons/abc123.jpg",
  "timestamp": "2026-06-06T12:00:00+09:00"
}
```

#### 画像メッセージ受信

```json
{
  "id": 124,
  "type": "image",
  "image_url": "https://yourdomain.com/media/chat_pictures/def456.jpg",
  "user_id": 42,
  "nickname": "田中",
  "icon_url": "https://yourdomain.com/media/icons/abc123.jpg",
  "timestamp": "2026-06-06T12:01:00+09:00"
}
```

### チャット画像のアップロードフロー

チャット画像はWebSocketでは送れない（バイナリ送信は避ける）。以下のフローで処理する：

```
1. REST POST /api/chat/{home_id}/images でファイルをアップロード
   → image_path を受け取る

2. WebSocketで {"type": "image", "image_path": "..."} を送信
   → サーバーがDBに保存してbroadcast
```

```python
# REST エンドポイント（router.py に追加）
@router.post("/{home_id}/images")
async def upload_chat_image(
    home_id: int,
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> dict:
    path = await save_image(image, directory="chat_pictures", max_mb=10)
    return {"image_path": path}
```

---

## フロントエンド実装

### WebSocket接続フック（src/features/chat/hooks/useChatSocket.ts）

```typescript
import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";

interface ChatMessage {
  id: number;
  type: "message" | "image";
  message?: string;
  imageUrl?: string;
  userId: number;
  nickname: string;
  iconUrl: string | null;
  timestamp: string;
}

interface UseChatSocketReturn {
  sendMessage: (text: string) => void;
  sendImage: (imagePath: string) => void;
  isConnected: boolean;
}

export const useChatSocket = (
  onMessage: (msg: ChatMessage) => void,
): UseChatSocketReturn => {
  const homeId = useAuthStore((s) => s.home?.id);
  const wsRef = useRef<WebSocket | null>(null);
  const isConnectedRef = useRef(false);

  useEffect(() => {
    if (!homeId) return;

    const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:8000";
    const ws = new WebSocket(`${wsBaseUrl}/api/chat/ws/${homeId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      isConnectedRef.current = true;
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // snake_case → camelCase 変換
      onMessage({
        id: data.id,
        type: data.type,
        message: data.message,
        imageUrl: data.image_url,
        userId: data.user_id,
        nickname: data.nickname,
        iconUrl: data.icon_url,
        timestamp: data.timestamp,
      });
    };

    ws.onclose = (event) => {
      isConnectedRef.current = false;
      // 4001/4003 は認証エラー（再接続しない）
      if (event.code !== 4001 && event.code !== 4003) {
        // 3秒後に再接続を試みる
        setTimeout(() => {
          // useEffect が再実行されるよう状態を変化させる（必要に応じて）
        }, 3000);
      }
    };

    ws.onerror = () => {
      isConnectedRef.current = false;
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [homeId]);

  const sendMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", message: text }));
    }
  }, []);

  const sendImage = useCallback((imagePath: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "image", image_path: imagePath }));
    }
  }, []);

  return {
    sendMessage,
    sendImage,
    isConnected: isConnectedRef.current,
  };
};
```

### チャット履歴取得フック（src/features/chat/hooks/useChat.ts）

```typescript
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";

export const useChatHistory = () => {
  const homeId = useAuthStore((s) => s.home?.id);

  return useInfiniteQuery({
    queryKey: ["chat", homeId],
    queryFn: async ({ pageParam }) => {
      const params = pageParam ? `?before_id=${pageParam}&limit=50` : "?limit=50";
      const { data } = await apiClient.get(`/api/chat/${homeId}/messages${params}`);
      return data;
    },
    getNextPageParam: (firstPage) =>
      firstPage.length === 50 ? firstPage[0]?.id : undefined,
    initialPageParam: undefined,
    enabled: !!homeId,
  });
};
```

### チャット画像送信フック

```typescript
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";

export const useUploadChatImage = () => {
  const homeId = useAuthStore((s) => s.home?.id);

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      const { data } = await apiClient.post(
        `/api/chat/${homeId}/images`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data as { image_path: string };
    },
  });
};
```

---

## WebSocketクローズコード

| コード | 意味 | クライアントの対応 |
|--------|------|-----------------|
| 1000 | 正常切断 | 再接続しない |
| 1001 | サーバー停止 | 再接続を試みる |
| 4001 | 認証エラー（JWTなし） | `/login` にリダイレクト |
| 4003 | 権限エラー（home_idが一致しない） | `/home-select` にリダイレクト |

---

## 注意事項

1. **HTTPonly CookieはWebSocket接続時にも自動送信される。** ただし、FastAPIのWebSocket依存関係（`Depends()`）では `Cookie()` が正常に動作しないため、`websocket.cookies` から手動で取得する。

2. **WebSocketコンテナ（worker）は状態を共有しない。** 本番でバックエンドをスケールアウトした場合、ConnectionManagerはプロセス内メモリのため、複数のバックエンドインスタンス間でメッセージが共有されない。スケールアウトが必要になったときはRedis Pub/Subを使ったブロードキャストに移行する（現時点では1インスタンス運用を前提とする）。

3. **チャット画像はWebSocketではなくRESTで送る。** WebSocketでバイナリを送ると複雑になるため、REST APIで先にアップロードしてパスを取得してからWebSocketで通知する。

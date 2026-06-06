# エラーハンドリング方針

## バックエンド（FastAPI）

### HTTPステータスコード規約

| コード | 用途 | 例 |
|--------|------|---|
| 200 | 正常（GET・PUT） | データ取得・更新成功 |
| 201 | 作成成功（POST） | お知らせ作成 |
| 204 | 削除成功（DELETE・コンテンツなし） | プッシュ通知送信 |
| 400 | バッドリクエスト | 無効な招待コード |
| 401 | 未認証 | トークンなし・期限切れ |
| 403 | 権限なし | 他ホームのデータアクセス |
| 404 | リソースなし | 存在しないお知らせID |
| 409 | 競合 | 既にいいね済み・招待コード使用済み |
| 422 | バリデーションエラー | Pydanticが自動返却 |
| 500 | サーバーエラー | 予期しないエラー |

### グローバルエラーハンドラー（app/main.py）

```python
from fastapi import Request
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "サーバーエラーが発生しました"},
    )
```

### エラーレスポンス形式

```json
// 単一エラー
{ "detail": "お知らせが見つかりません" }

// Pydanticバリデーションエラー（自動）
{
  "detail": [
    {
      "type": "string_too_short",
      "loc": ["body", "title"],
      "msg": "String should have at least 1 character",
      "input": ""
    }
  ]
}
```

### サービス層のエラー実装パターン

```python
from fastapi import HTTPException

class AnnounceService:
    async def get_by_id(self, id: int, home_id: int) -> Announce:
        announce = await self.db.get(Announce, id)
        if not announce:
            raise HTTPException(status_code=404, detail="お知らせが見つかりません")
        # ホームの所有確認（権限チェック）
        if announce.home_id != home_id:
            raise HTTPException(status_code=403, detail="このお知らせへのアクセス権がありません")
        return announce
```

---

## フロントエンド（React）

### APIクライアントのエラーハンドリング

```typescript
// src/lib/apiClient.ts

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ detail: string | Array<{ msg: string }> }>) => {
    // 401 → トークンリフレッシュ
    if (error.response?.status === 401 && !error.config?._retry) {
      error.config!._retry = true;
      try {
        await apiClient.post("/api/auth/refresh");
        return apiClient(error.config!);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);
```

### エラーメッセージの取り出しユーティリティ

```typescript
// src/utils/error.ts

import type { AxiosError } from "axios";

type ApiErrorDetail = string | Array<{ msg: string }>;

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && "response" in error) {
    const axiosError = error as AxiosError<{ detail: ApiErrorDetail }>;
    const detail = axiosError.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d) => d.msg).join(", ");
  }
  return "予期しないエラーが発生しました";
};
```

### TanStack Queryでのエラー表示パターン

```typescript
// src/features/announces/pages/AnnounceListPage.tsx

import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error";

export const AnnounceListPage = () => {
  const { data, isLoading, error } = useAnnounces(homeId);

  // ローディング状態
  if (isLoading) return <LoadingSpinner />;

  // エラー状態
  if (error) {
    return <ErrorMessage message={getErrorMessage(error)} />;
  }

  return <AnnounceList announces={data} />;
};

// Mutationエラーはtoastで表示
const { mutate: createAnnounce } = useCreateAnnounce({
  onError: (error) => {
    toast.error(getErrorMessage(error));
  },
});
```

### 共通エラー表示コンポーネント

```typescript
// src/components/ui/ErrorMessage.tsx

interface ErrorMessageProps {
  message: string;
  retry?: () => void;
}

export const ErrorMessage = ({ message, retry }: ErrorMessageProps) => (
  <div className="flex flex-col items-center gap-4 py-8 text-center">
    <p className="text-red-500">{message}</p>
    {retry && (
      <button onClick={retry} className="text-blue-500 underline">
        再試行
      </button>
    )}
  </div>
);
```

---

## ロギング方針（バックエンド）

```python
# app/core/logging.py

import logging
import sys
from app.core.config import settings

def setup_logging() -> None:
    level = logging.DEBUG if settings.DEBUG else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stdout,
    )

# 使い方（各モジュールで）
logger = logging.getLogger(__name__)

# 情報ログ
logger.info("ユーザー %d がホーム %d に参加", user_id, home_id)

# 警告ログ
logger.warning("FCMトークン %s が無効のためスキップ", token)

# エラーログ（例外情報付き）
logger.error("清算処理中にエラーが発生", exc_info=True)
```

### ログレベル方針

| レベル | 用途 |
|--------|------|
| DEBUG | 開発時のSQLクエリ・変数の値（本番では出力しない） |
| INFO | 正常系の主要操作（ログイン・ホーム作成・清算実行等） |
| WARNING | 想定内の異常（無効FCMトークン・期限切れ招待コード等） |
| ERROR | 想定外エラー・例外（常にexc_info=Trueをつける） |

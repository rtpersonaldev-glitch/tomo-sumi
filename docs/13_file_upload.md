# ファイルアップロード仕様

## 対象機能と保存先

| 機能 | ファイル種別 | 保存先ディレクトリ | 最大サイズ |
|------|-----------|----------------|----------|
| ユーザーアイコン | 画像（JPG/PNG/WebP） | `media/icons/` | 5MB |
| ホーム画像 | 画像（JPG/PNG/WebP） | `media/home_images/` | 5MB |
| アルバム写真 | 画像（JPG/PNG/WebP） | `media/pictures/` | 10MB |
| 投稿画像（複数可） | 画像（JPG/PNG/WebP） | `media/post_pictures/` | 10MB × 枚 |
| チャット画像 | 画像（JPG/PNG/WebP） | `media/chat_pictures/` | 10MB |
| レシート画像（支出） | 画像（JPG/PNG/WebP） | `media/receipt_images/` | 10MB |

---

## バックエンド実装

### ファイルストレージユーティリティ（app/utils/file_storage.py）

```python
import uuid
from pathlib import Path
from fastapi import UploadFile, HTTPException
from PIL import Image
import io

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MEDIA_ROOT = Path("media")


def _validate_image(file: UploadFile, max_mb: int) -> None:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"対応していないファイル形式です。JPEG / PNG / WebP のみ使用できます。",
        )
    # ファイルサイズはアップロード後にチェック（Fastapi制限はnginxで設定）


async def save_image(
    file: UploadFile,
    directory: str,
    max_mb: int = 10,
) -> str:
    """
    画像を保存してメディア相対パスを返す。

    Returns:
        str: "{directory}/{uuid}.{ext}" 形式のパス（media/は含まない）
    """
    _validate_image(file, max_mb)

    contents = await file.read()

    # サイズチェック
    if len(contents) > max_mb * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"ファイルサイズは {max_mb}MB 以下にしてください。",
        )

    # PILで開けるか確認（破損ファイル対策）
    try:
        image = Image.open(io.BytesIO(contents))
        image.verify()
    except Exception:
        raise HTTPException(status_code=400, detail="画像ファイルが壊れています。")

    ext = file.content_type.split("/")[-1].replace("jpeg", "jpg")
    filename = f"{uuid.uuid4().hex}.{ext}"
    save_dir = MEDIA_ROOT / directory
    save_dir.mkdir(parents=True, exist_ok=True)
    save_path = save_dir / filename

    with open(save_path, "wb") as f:
        f.write(contents)

    return f"{directory}/{filename}"


def delete_image(relative_path: str | None) -> None:
    """メディア相対パスのファイルを削除する（存在しない場合は無視）"""
    if not relative_path:
        return
    file_path = MEDIA_ROOT / relative_path
    if file_path.exists():
        file_path.unlink()


def get_media_url(relative_path: str | None, base_url: str) -> str | None:
    """相対パスをフルURLに変換する"""
    if not relative_path:
        return None
    return f"{base_url}/media/{relative_path}"
```

---

### ルーターでのファイル受け取りパターン

#### 単一画像（例：ユーザーアイコン更新）

```python
# app/features/auth/router.py

from fastapi import UploadFile, File, Form

@router.put("/profile")
async def update_profile(
    nickname: str = Form(...),
    icon: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await AuthService(db).update_profile(current_user, nickname, icon)
```

```python
# app/features/auth/service.py

from app.utils.file_storage import save_image, delete_image
from app.core.config import settings

class AuthService:
    async def update_profile(
        self, user: User, nickname: str, icon: UploadFile | None
    ) -> User:
        user.nickname = nickname

        if icon:
            # 旧アイコンを削除してから保存
            delete_image(user.icon_path)
            user.icon_path = await save_image(icon, directory="icons", max_mb=5)

        await self.db.flush()
        return user
```

#### 複数画像（例：投稿の画像）

```python
# app/features/posts/router.py

from fastapi import UploadFile, File, Form
from typing import Annotated

@router.post("", response_model=PostDetailResponse, status_code=201)
async def create_post(
    content: str = Form(...),
    images: Annotated[list[UploadFile], File()] = [],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_home: Home = Depends(get_current_home),
):
    return await PostService(db).create(content, images, current_user, current_home)
```

```python
# app/features/posts/service.py

class PostService:
    async def create(
        self,
        content: str,
        images: list[UploadFile],
        user: User,
        home: Home,
    ) -> Post:
        post = Post(content=content, home_id=home.id, created_by=user.id)
        self.db.add(post)
        await self.db.flush()  # post.idを確定させる

        for image in images:
            path = await save_image(image, directory="post_pictures", max_mb=10)
            self.db.add(PostPicture(post_id=post.id, image_path=path))

        return post
```

#### JSON + 画像の混在（例：アルバム作成）

```python
# app/features/albums/router.py

@router.post("", response_model=AlbumDetailResponse, status_code=201)
async def create_album(
    title: str = Form(...),
    date: str = Form(...),           # ISO8601形式 "2026-06-01"
    pictures: Annotated[list[UploadFile], File()] = [],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_home: Home = Depends(get_current_home),
):
    return await AlbumService(db).create(title, date, pictures, current_user, current_home)
```

---

### スキーマのURLフィールド定義

```python
# app/features/auth/schemas.py

from app.core.config import settings
from app.utils.file_storage import get_media_url

class UserResponse(BaseModel):
    id: int
    nickname: str
    email: str
    icon_url: str | None    # パスではなくURLで返す
    status: str

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_model(cls, user: User) -> "UserResponse":
        return cls(
            id=user.id,
            nickname=user.nickname,
            email=user.email,
            icon_url=get_media_url(user.icon_path, settings.MEDIA_BASE_URL),
            status=user.status,
        )
```

> **ルール：** DBにはパスのみ保存（例: `"icons/abc123.jpg"`）。レスポンスでは必ずURLに変換して返す。

---

## フロントエンド実装

### FormData送信パターン

```typescript
// src/features/posts/hooks/useCreatePost.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

interface CreatePostInput {
  content: string;
  images: File[];
}

export const useCreatePost = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, images }: CreatePostInput) => {
      const formData = new FormData();
      formData.append("content", content);
      images.forEach((image) => formData.append("images", image));

      const { data } = await apiClient.post("/api/posts", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
};
```

### プロフィール更新（単一画像 + テキスト）

```typescript
// src/features/auth/hooks/useUpdateProfile.ts

export const useUpdateProfile = () => {
  const { setUser } = useAuthStore();

  return useMutation({
    mutationFn: async ({ nickname, icon }: { nickname: string; icon?: File }) => {
      const formData = new FormData();
      formData.append("nickname", nickname);
      if (icon) formData.append("icon", icon);

      const { data } = await apiClient.put("/api/auth/profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: (user) => setUser(user),
  });
};
```

### 画像プレビュー + react-cropperパターン

```typescript
// src/features/auth/components/IconCropper.tsx

import { useRef, useState } from "react";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";

interface IconCropperProps {
  onCropped: (file: File) => void;
}

export const IconCropper = ({ onCropped }: IconCropperProps) => {
  const cropperRef = useRef<HTMLImageElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onCrop = () => {
    const cropper = (cropperRef.current as any)?.cropper;
    if (!cropper) return;
    cropper.getCroppedCanvas({ width: 256, height: 256 }).toBlob(
      (blob: Blob | null) => {
        if (!blob) return;
        const file = new File([blob], "icon.jpg", { type: "image/jpeg" });
        onCropped(file);
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <div>
      <input type="file" accept="image/*" onChange={onFileChange} />
      {src && (
        <>
          <Cropper
            src={src}
            ref={cropperRef}
            style={{ height: 300, width: "100%" }}
            aspectRatio={1}
            guides={false}
            viewMode={1}
          />
          <button onClick={onCrop} className="mt-2 btn-primary">
            切り抜く
          </button>
        </>
      )}
    </div>
  );
};
```

### 画像URLの表示パターン

```typescript
// src/components/ui/UserAvatar.tsx

interface UserAvatarProps {
  iconUrl: string | null;
  nickname: string;
  size?: "sm" | "md" | "lg";
}

const sizeClass = { sm: "w-8 h-8", md: "w-12 h-12", lg: "w-20 h-20" };

export const UserAvatar = ({ iconUrl, nickname, size = "md" }: UserAvatarProps) => {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={nickname}
        className={`${sizeClass[size]} rounded-full object-cover`}
      />
    );
  }
  return (
    <div className={`${sizeClass[size]} rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold`}>
      {nickname.charAt(0)}
    </div>
  );
};
```

---

## nginx の最大ボディサイズ設定

```nginx
# docker/nginx/nginx.conf

http {
    client_max_body_size 20M;   # ← アップロード上限（全エンドポイント共通）
    ...
}
```

> **注意：** Viteプロキシ経由（開発時）でもこの制限は適用されない。開発時はFastAPIのデフォルト制限のみ。本番はnginxの設定が優先される。

---

## 注意事項

1. **DBにはURLを保存しない。** パス（例: `"icons/abc123.jpg"`）のみ保存し、レスポンス生成時に `get_media_url()` でURLに変換する。ドメイン変更時の修正を最小化するため。

2. **ファイル削除は必ず旧ファイルを削除してから新ファイルを保存する。** `delete_image(old_path)` → `save_image(new_file)` の順を守る。

3. **Pillow の `verify()` は1回しか使えない。** `verify()` 後は画像を再オープンする必要がある（処理中の画像リサイズ等が必要な場合）。

4. **`multipart/form-data` のエンドポイントはJSONボディ不可。** FastAPIの制約として、`File()` または `Form()` を使うエンドポイントでは `Body()`（JSON）が使えない。JSON項目はすべて `Form()` で受け取る。

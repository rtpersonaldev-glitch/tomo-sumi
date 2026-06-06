import io
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MEDIA_ROOT = Path("media")


def _validate_image(file: UploadFile, max_mb: int) -> None:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="対応していないファイル形式です。JPEG / PNG / WebP のみ使用できます。",
        )


async def save_image(
    file: UploadFile,
    directory: str,
    max_mb: int = 10,
) -> str:
    """画像を保存してメディア相対パスを返す。

    Returns:
        str: "{directory}/{uuid}.{ext}" 形式のパス（media/ は含まない）
    """
    _validate_image(file, max_mb)

    contents = await file.read()

    if len(contents) > max_mb * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"ファイルサイズは {max_mb}MB 以下にしてください。",
        )

    try:
        image = Image.open(io.BytesIO(contents))
        image.verify()
    except Exception:
        raise HTTPException(status_code=400, detail="画像ファイルが壊れています。")

    ext = (file.content_type or "image/jpeg").split("/")[-1].replace("jpeg", "jpg")
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
    return f"{base_url}/{relative_path}"

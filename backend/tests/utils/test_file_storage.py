import io
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException, UploadFile
from PIL import Image

import app.utils.file_storage as fs
from app.utils.file_storage import delete_image, get_media_url, save_image


def _make_valid_png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color=(255, 0, 0)).save(buf, format="PNG")
    return buf.getvalue()


def _make_upload_file(content: bytes, content_type: str = "image/png") -> UploadFile:
    mock = AsyncMock(spec=UploadFile)
    mock.content_type = content_type
    mock.read = AsyncMock(return_value=content)
    return mock


@pytest.fixture(autouse=True)
def patch_media_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fs, "MEDIA_ROOT", tmp_path)


# ─── save_image ───────────────────────────────────────────────────────────────


async def test_save_image_success() -> None:
    """有効な画像を保存し相対パスを返す"""
    file = _make_upload_file(_make_valid_png(), "image/png")
    path = await save_image(file, directory="icons", max_mb=5)
    assert path.startswith("icons/")
    assert path.endswith(".png")


async def test_save_image_jpeg_ext() -> None:
    """JPEG ファイルの拡張子が .jpg になる"""
    buf = io.BytesIO()
    Image.new("RGB", (10, 10)).save(buf, format="JPEG")
    file = _make_upload_file(buf.getvalue(), "image/jpeg")
    path = await save_image(file, directory="icons", max_mb=5)
    assert path.endswith(".jpg")


async def test_save_image_invalid_content_type() -> None:
    """非対応形式で 400 を返す"""
    file = _make_upload_file(b"fake-pdf-content", "application/pdf")
    with pytest.raises(HTTPException) as exc:
        await save_image(file, directory="icons", max_mb=5)
    assert exc.value.status_code == 400


async def test_save_image_too_large() -> None:
    """最大サイズ超過で 400 を返す"""
    large_content = b"a" * (6 * 1024 * 1024)
    file = _make_upload_file(large_content, "image/png")
    with pytest.raises(HTTPException) as exc:
        await save_image(file, directory="icons", max_mb=5)
    assert exc.value.status_code == 400


async def test_save_image_corrupted() -> None:
    """破損ファイルで 400 を返す"""
    file = _make_upload_file(b"not-a-real-image", "image/png")
    with pytest.raises(HTTPException) as exc:
        await save_image(file, directory="icons", max_mb=5)
    assert exc.value.status_code == 400


async def test_save_image_creates_directory() -> None:
    """保存先ディレクトリが自動作成される"""
    file = _make_upload_file(_make_valid_png(), "image/png")
    await save_image(file, directory="albums/photos", max_mb=10)
    assert (fs.MEDIA_ROOT / "albums" / "photos").exists()


# ─── delete_image ─────────────────────────────────────────────────────────────


def test_delete_image_existing() -> None:
    """存在するファイルを削除する"""
    test_dir = fs.MEDIA_ROOT / "icons"
    test_dir.mkdir(parents=True, exist_ok=True)
    test_file = test_dir / "test.jpg"
    test_file.write_bytes(b"dummy")

    delete_image("icons/test.jpg")
    assert not test_file.exists()


def test_delete_image_nonexistent() -> None:
    """存在しないパスを渡しても例外を上げない"""
    delete_image("icons/nonexistent.jpg")


def test_delete_image_none() -> None:
    """None を渡しても例外を上げない"""
    delete_image(None)


# ─── get_media_url ────────────────────────────────────────────────────────────


def test_get_media_url_with_path() -> None:
    url = get_media_url("icons/abc123.jpg", "http://localhost:8000/media")
    assert url == "http://localhost:8000/media/icons/abc123.jpg"


def test_get_media_url_with_none() -> None:
    assert get_media_url(None, "http://localhost:8000/media") is None

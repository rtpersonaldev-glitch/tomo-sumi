import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error";
import { useAlbum, useCreateAlbum, useDeletePicture, useUpdateAlbum } from "../hooks/useAlbum";
import type { AlbumPictureResponse } from "../types";

export default function AlbumEditPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const albumId = id ? parseInt(id, 10) : undefined;

  const { data: existing, isLoading: loadingExisting } = useAlbum(albumId, isEdit);
  const createAlbum = useCreateAlbum();
  const updateAlbum = useUpdateAlbum();
  const deletePicture = useDeletePicture();

  /* ── Form state ─────────────────────────────────────────────── */
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (isEdit && existing) {
      setTitle(existing.title);
    }
  }, [existing, isEdit]);

  /* ── Image cropper ─────────────────────────────────────────── */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<any>(null);
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);
  const [croppedFiles, setCroppedFiles] = useState<File[]>([]);
  const [croppedPreviews, setCroppedPreviews] = useState<string[]>([]);

  /* existing pics that haven't been deleted yet (edit mode) */
  const [deletedPicIds, setDeletedPicIds] = useState<Set<number>>(new Set());
  const visibleExistingPics: AlbumPictureResponse[] = isEdit && existing
    ? existing.pictures.filter((p) => !deletedPicIds.has(p.id))
    : [];
  const totalCount = visibleExistingPics.length + croppedFiles.length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = () => setPendingSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCrop = useCallback(() => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    cropper.getCroppedCanvas({ maxWidth: 1920, maxHeight: 1920 }).toBlob(
      (blob: Blob | null) => {
        if (!blob) return;
        const file = new File([blob], `image_${Date.now()}.jpg`, { type: "image/jpeg" });
        const previewUrl = URL.createObjectURL(blob);
        setCroppedFiles((prev) => [...prev, file]);
        setCroppedPreviews((prev) => [...prev, previewUrl]);
        setPendingSrc(null);
      },
      "image/jpeg",
      0.9,
    );
  }, []);

  const handleRemoveNew = (index: number) => {
    URL.revokeObjectURL(croppedPreviews[index]);
    setCroppedFiles((prev) => prev.filter((_, i) => i !== index));
    setCroppedPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExisting = (pic: AlbumPictureResponse) => {
    setDeletedPicIds((prev) => new Set([...prev, pic.id]));
  };

  const isPending = createAlbum.isPending || updateAlbum.isPending || deletePicture.isPending;

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("アルバム名を入力してください");
      return;
    }
    try {
      if (isEdit && albumId) {
        for (const picId of deletedPicIds) {
          await deletePicture.mutateAsync({ albumId, picId });
        }
        await updateAlbum.mutateAsync({ id: albumId, title: title.trim(), pictures: croppedFiles });
        toast.success("アルバムを更新しました");
        navigate(`/albums/${albumId}`);
      } else {
        const album = await createAlbum.mutateAsync({ title: title.trim(), pictures: croppedFiles });
        toast.success("アルバムを作成しました");
        navigate(`/albums/${album.id}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (isEdit && loadingExisting) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="読み込み中" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(isEdit ? `/albums/${albumId}` : "/albums")}
          className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          aria-label="キャンセルして戻る"
        >
          ‹ キャンセル
        </button>
        <h1 className="text-xl font-semibold">{isEdit ? "アルバム編集" : "アルバム作成"}</h1>
      </div>

      {/* Title */}
      <div className="rounded-xl border border-border bg-card shadow-sm dark:shadow-none p-4 space-y-2">
        <label htmlFor="album-title" className="text-sm font-medium">
          アルバム名 <span className="text-destructive" aria-hidden>*</span>
        </label>
        <input
          id="album-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例：夏の旅行 2026"
          maxLength={50}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
          aria-label="アルバム名"
        />
        <p className="text-xs text-muted-foreground text-right">{title.length}/50</p>
      </div>

      {/* Images */}
      <div className="rounded-xl border border-border bg-card shadow-sm dark:shadow-none p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            写真
            <span className="ml-1.5 text-xs text-muted-foreground">
              （{totalCount}枚・各10MBまで）
            </span>
          </span>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* existing pictures (edit mode) */}
          {visibleExistingPics.map((pic) => (
            <div
              key={pic.id}
              className="relative overflow-hidden rounded-lg border border-border"
              style={{ width: 72, height: 72 }}
            >
              <img src={pic.image_url} alt="既存の写真" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemoveExisting(pic)}
                aria-label="この写真を削除"
                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* newly cropped previews */}
          {croppedPreviews.map((url, i) => (
            <div
              key={url}
              className="relative overflow-hidden rounded-lg border border-border"
              style={{ width: 72, height: 72 }}
            >
              <img src={url} alt={`追加写真 ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemoveNew(i)}
                aria-label={`追加写真 ${i + 1} を削除`}
                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* add button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-primary hover:border-primary/60 hover:bg-secondary/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ width: 72, height: 72 }}
            aria-label="写真を追加"
          >
            <span className="text-xl leading-none">＋</span>
            <span className="text-[10px] font-semibold">追加</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
          aria-hidden
        />

        <p className="text-[11px] text-muted-foreground">
          画像を選択するとクロップ画面が表示されます
        </p>
      </div>

      {/* Cropper modal */}
      {pendingSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl bg-card overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold">画像を切り抜く</span>
              <button
                type="button"
                onClick={() => setPendingSrc(null)}
                aria-label="キャンセル"
                className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-black">
              <Cropper
                ref={cropperRef}
                src={pendingSrc}
                style={{ height: 300, width: "100%" }}
                guides
                viewMode={1}
                dragMode="move"
                background={false}
                responsive
                autoCropArea={1}
              />
            </div>
            <div className="flex gap-2 px-4 py-3 border-t border-border">
              <button
                type="button"
                onClick={() => setPendingSrc(null)}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleCrop}
                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                ✓ 切り抜く
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            処理中...
          </>
        ) : isEdit ? (
          "更新する"
        ) : (
          "作成する"
        )}
      </button>
    </div>
  );
}

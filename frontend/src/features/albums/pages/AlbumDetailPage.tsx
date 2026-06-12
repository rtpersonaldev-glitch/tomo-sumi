import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useAlbum, useDeleteAlbum } from "../hooks/useAlbum";
import type { AlbumPictureResponse } from "../types";

function Lightbox({
  pictures,
  initialIndex,
  onClose,
}: {
  pictures: AlbumPictureResponse[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(initialIndex);
  const pic = pictures[current];

  const handlePrev = () => setCurrent((i) => (i - 1 + pictures.length) % pictures.length);
  const handleNext = () => setCurrent((i) => (i + 1) % pictures.length);

  if (!pic) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal
      aria-label="写真を拡大表示"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-5 w-5" />
      </button>

      <img
        src={pic.image_url}
        alt={`写真 ${current + 1}`}
        className="max-h-[70vh] max-w-full rounded-lg object-contain"
      />

      <div className="flex items-center gap-8 mt-5">
        <button
          type="button"
          onClick={handlePrev}
          disabled={pictures.length <= 1}
          aria-label="前の写真"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm text-white/70">
          {current + 1} / {pictures.length}
        </span>
        <button
          type="button"
          onClick={handleNext}
          disabled={pictures.length <= 1}
          aria-label="次の写真"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export default function AlbumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const albumId = parseInt(id!, 10);

  const { data: album, isLoading, isError } = useAlbum(albumId);
  const deleteAlbum = useDeleteAlbum();

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleDeleteAlbum = async () => {
    try {
      await deleteAlbum.mutateAsync(albumId);
      toast.success("アルバムを削除しました");
      navigate("/albums");
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleteConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="読み込み中" />
      </div>
    );
  }

  if (isError || !album) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          アルバムの取得に失敗しました
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/albums")}
            className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label="アルバム一覧に戻る"
          >
            ‹ 戻る
          </button>
          <h1 className="flex-1 text-xl font-semibold truncate">{album.title}</h1>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate(`/albums/${albumId}/edit`)}
              className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              編集
            </button>
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="text-sm text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              削除
            </button>
          </div>
        </div>

        {/* Delete confirm */}
        {deleteConfirm && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 space-y-2">
            <p className="text-xs text-center text-destructive font-medium">
              アルバムを削除しますか？写真もすべて削除されます。この操作は元に戻せません。
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 rounded-lg border border-border py-1.5 text-xs font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDeleteAlbum}
                disabled={deleteAlbum.isPending}
                className="flex-1 rounded-lg bg-destructive py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
              >
                {deleteAlbum.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  "削除する"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Photo grid */}
        {album.pictures.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <span className="text-4xl" aria-hidden>
              📷
            </span>
            <p className="text-sm">まだ写真がありません</p>
          </div>
        ) : (
          <div
            className={cn(
              "grid gap-1",
              album.pictures.length === 1
                ? "grid-cols-1"
                : album.pictures.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-3",
            )}
          >
            {album.pictures.map((pic, i) => (
              <button
                key={pic.id}
                type="button"
                onClick={() => setLightboxIndex(i)}
                aria-label={`写真 ${i + 1} を拡大表示`}
                className={cn(
                  "overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  album.pictures.length === 1 ? "aspect-video" : "aspect-square",
                )}
              >
                <img
                  src={pic.image_url}
                  alt={`写真 ${i + 1}`}
                  className="h-full w-full object-cover hover:opacity-90 transition-opacity"
                />
              </button>
            ))}
          </div>
        )}

        {/* Add photos button */}
        <button
          type="button"
          onClick={() => navigate(`/albums/${albumId}/edit`)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-primary hover:border-primary/50 hover:bg-secondary/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          📷 写真を追加する
        </button>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && album.pictures.length > 0 && (
        <Lightbox
          pictures={album.pictures}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { useAlbums } from "../hooks/useAlbum";

export default function AlbumListPage() {
  const navigate = useNavigate();
  const { data: albums, isLoading, isError } = useAlbums();

  const [searchQuery, setSearchQuery] = useState("");

  const filteredAlbums = useMemo(() => {
    if (!albums) return [];
    const q = searchQuery.trim().toLowerCase();
    if (q === "") return albums;
    return albums.filter((a) => a.title.toLowerCase().includes(q));
  }, [albums, searchQuery]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">アルバム</h1>
        <button
          type="button"
          onClick={() => navigate("/albums/new")}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ＋ 作成
        </button>
      </div>

      {/* フィルターバー */}
      {!isLoading && !isError && (albums?.length ?? 0) > 0 && (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
            🔍
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="タイトルで検索..."
            aria-label="アルバムを検索"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
          />
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="読み込み中" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          アルバムの取得に失敗しました
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {albums?.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
              <span className="text-5xl" aria-hidden>
                📷
              </span>
              <p className="text-sm">まだアルバムがありません</p>
              <button
                type="button"
                onClick={() => navigate("/albums/new")}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                ＋ 最初のアルバムを作成
              </button>
            </div>
          )}

          {(albums?.length ?? 0) > 0 && filteredAlbums.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <span className="text-4xl" aria-hidden>
                🔍
              </span>
              <p className="text-sm">条件に一致するアルバムがありません</p>
            </div>
          )}

          {filteredAlbums.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filteredAlbums.map((album) => (
                <button
                  key={album.id}
                  type="button"
                  onClick={() => navigate(`/albums/${album.id}`)}
                  className="rounded-xl border border-border bg-card overflow-hidden shadow-sm dark:shadow-none text-left hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="aspect-square w-full overflow-hidden bg-secondary/40">
                    {album.thumbnail_url ? (
                      <img
                        src={album.thumbnail_url}
                        alt={album.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl text-muted-foreground">
                        📷
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-sm font-semibold truncate">{album.title}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {album.picture_count}枚
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(album.created_at), "M月d日", { locale: ja })}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useHomeMembers } from "@/features/home/hooks/useHome";
import { useAuthStore } from "@/store/authStore";
import type { HomeMemberResponse } from "@/features/home/types";
import { usePosts, useToggleLike } from "../hooks/usePost";
import type { PostListResponse } from "../types";

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? div.innerText ?? "";
}

function MemberAvatar({
  member,
  size = "sm",
}: {
  member: HomeMemberResponse;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  if (member.icon_url) {
    return (
      <img
        src={member.icon_url}
        alt={member.nickname}
        className={cn(dim, "rounded-full object-cover")}
      />
    );
  }
  return (
    <span
      className={cn(
        dim,
        "inline-flex items-center justify-center rounded-full bg-primary font-bold text-primary-foreground",
      )}
    >
      {member.nickname.charAt(0)}
    </span>
  );
}

function CreatorChip({
  userId,
  members,
}: {
  userId: number | null;
  members: HomeMemberResponse[];
}) {
  if (!userId) return null;
  const member = members.find((m) => m.id === userId);
  if (!member) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <MemberAvatar member={member} size="sm" />
      <span className="text-xs font-medium">{member.nickname}</span>
    </span>
  );
}

function ImageThumbnails({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  const shown = urls.slice(0, 3);
  const rest = urls.length - 3;
  return (
    <div className="flex gap-1.5 mb-3">
      {shown.map((url, i) => {
        const isLast = i === 2 && rest > 0;
        return (
          <div key={url} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
            <img src={url} alt="" className="h-full w-full object-cover" />
            {isLast && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <span className="text-xs font-bold text-white">+{rest}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PostCard({
  post,
  members,
  onToggleLike,
  isTogglingLike,
}: {
  post: PostListResponse;
  members: HomeMemberResponse[];
  currentUserId: number | undefined;
  onToggleLike: (postId: number) => void;
  isTogglingLike: boolean;
}) {
  const navigate = useNavigate();
  const preview = stripHtml(post.content);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm dark:shadow-none">
      <div
        className="px-4 pt-3 pb-2 cursor-pointer"
        onClick={() => navigate(`/posts/${post.id}`)}
        role="button"
        tabIndex={0}
        aria-label={`投稿詳細を見る`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") navigate(`/posts/${post.id}`);
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <CreatorChip userId={post.created_by} members={members} />
          <span className="text-xs text-muted-foreground">
            · {format(parseISO(post.created_at), "M月d日", { locale: ja })}
          </span>
        </div>

        {preview && (
          <p className="text-sm leading-relaxed text-foreground line-clamp-3 mb-2">
            {preview}
          </p>
        )}

        <ImageThumbnails urls={post.picture_urls} />
      </div>

      <div className="flex items-center gap-3 px-4 py-2 border-t border-border bg-secondary/20">
        <button
          type="button"
          onClick={() => onToggleLike(post.id)}
          disabled={isTogglingLike}
          aria-pressed={post.is_liked}
          aria-label={post.is_liked ? "いいねを取り消す" : "いいねする"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
            post.is_liked
              ? "border-red-200 bg-red-50 text-red-500 dark:border-red-900 dark:bg-red-950/30"
              : "border-border bg-background text-muted-foreground hover:border-red-200 hover:text-red-400",
          )}
        >
          {post.is_liked ? "❤️" : "🤍"} {post.like_count}
        </button>

        <button
          type="button"
          onClick={() => navigate(`/posts/${post.id}`)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="コメントを見る"
        >
          💬 {post.comment_count}
        </button>
      </div>
    </div>
  );
}

export default function PostListPage() {
  const navigate = useNavigate();
  const { data: posts, isLoading, isError } = usePosts();
  const { data: members = [] } = useHomeMembers();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const toggleLike = useToggleLike();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<number | "all">("all");

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    const q = searchQuery.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesMember =
        selectedMemberId === "all" || post.created_by === selectedMemberId;
      const matchesQuery =
        q === "" || stripHtml(post.content).toLowerCase().includes(q);
      return matchesMember && matchesQuery;
    });
  }, [posts, searchQuery, selectedMemberId]);

  const handleToggleLike = (postId: number) => {
    toggleLike.mutate(postId, {
      onError: (err) => toast.error(getErrorMessage(err)),
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">投稿</h1>
        <button
          type="button"
          onClick={() => navigate("/posts/new")}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-all"
        >
          ＋ 作成
        </button>
      </div>

      {/* フィルターバー */}
      {!isLoading && !isError && (posts?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="キーワードで検索..."
              aria-label="投稿を検索"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
            />
          </div>
          {members.length > 0 && (
            <select
              value={selectedMemberId}
              onChange={(e) =>
                setSelectedMemberId(
                  e.target.value === "all" ? "all" : parseInt(e.target.value, 10),
                )
              }
              aria-label="投稿者で絞り込み"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all cursor-pointer"
            >
              <option value="all">全員</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nickname}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="読み込み中" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          投稿の取得に失敗しました
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {posts?.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <span className="text-4xl" aria-hidden>
                📰
              </span>
              <p className="text-sm">まだ投稿がありません</p>
            </div>
          )}

          {(posts?.length ?? 0) > 0 && filteredPosts.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <span className="text-4xl" aria-hidden>
                🔍
              </span>
              <p className="text-sm">条件に一致する投稿がありません</p>
            </div>
          )}

          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                members={members}
                currentUserId={currentUserId}
                onToggleLike={handleToggleLike}
                isTogglingLike={toggleLike.isPending}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

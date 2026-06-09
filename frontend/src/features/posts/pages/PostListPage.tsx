import { useState } from "react";
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
import { usePosts, useDeletePost, useToggleLike } from "../hooks/usePost";
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
  currentUserId,
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
  const deletePost = useDeletePost();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const isOwn = currentUserId != null && post.created_by === currentUserId;
  const preview = stripHtml(post.content);

  const handleDelete = async () => {
    try {
      await deletePost.mutateAsync(post.id);
      toast.success("投稿を削除しました");
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleteConfirm(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm dark:shadow-none">
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <CreatorChip userId={post.created_by} members={members} />
            <span className="text-xs text-muted-foreground">
              · {format(parseISO(post.created_at), "M月d日", { locale: ja })}
            </span>
          </div>
          {isOwn && (
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={() => navigate(`/posts/${post.id}/edit`)}
                className="text-xs text-primary hover:underline"
                aria-label="投稿を編集"
              >
                編集
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                disabled={deleteConfirm}
                className="text-xs text-destructive hover:underline disabled:opacity-40"
                aria-label="投稿を削除"
              >
                削除
              </button>
            </div>
          )}
        </div>

        {preview && (
          <p
            className="text-sm leading-relaxed text-foreground line-clamp-3 mb-2 cursor-pointer"
            onClick={() => navigate(`/posts/${post.id}`)}
          >
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

      {deleteConfirm && (
        <div className="border-t border-destructive/30 bg-destructive/5 px-4 py-3 space-y-2">
          <p className="text-xs text-center text-destructive font-medium">
            この投稿を削除しますか？この操作は元に戻せません。
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDeleteConfirm(false)}
              className="flex-1 rounded-lg border border-border py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deletePost.isPending}
              className="flex-1 rounded-lg bg-destructive py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center"
            >
              {deletePost.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                "削除する"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PostListPage() {
  const navigate = useNavigate();
  const { data: posts, isLoading, isError } = usePosts();
  const { data: members = [] } = useHomeMembers();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const toggleLike = useToggleLike();

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

          <div className="space-y-4">
            {posts?.map((post) => (
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

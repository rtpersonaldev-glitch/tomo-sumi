import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { DotsMenu } from "@/components/DotsMenu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useHomeMembers } from "@/features/home/hooks/useHome";
import { useAuthStore } from "@/store/authStore";
import type { HomeMemberResponse } from "@/features/home/types";
import {
  usePost,
  useToggleLike,
  useAddComment,
  useDeleteComment,
  useDeletePost,
} from "../hooks/usePost";
import type { PostCommentResponse } from "../types";

function Lightbox({
  urls,
  initialIndex,
  onClose,
}: {
  urls: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(initialIndex);
  const pic = urls[current];

  const handlePrev = () => setCurrent((i) => (i - 1 + urls.length) % urls.length);
  const handleNext = () => setCurrent((i) => (i + 1) % urls.length);

  if (!pic) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal
      aria-label="画像を拡大表示"
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
        src={pic}
        alt={`投稿画像 ${current + 1}`}
        className="max-h-[70vh] max-w-full rounded-lg object-contain"
      />

      <div className="flex items-center gap-8 mt-5">
        <button
          type="button"
          onClick={handlePrev}
          disabled={urls.length <= 1}
          aria-label="前の画像"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm text-white/70">
          {current + 1} / {urls.length}
        </span>
        <button
          type="button"
          onClick={handleNext}
          disabled={urls.length <= 1}
          aria-label="次の画像"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function MemberAvatar({
  member,
  size = "md",
}: {
  member: HomeMemberResponse;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "sm"
      ? "h-6 w-6 text-[10px]"
      : size === "lg"
        ? "h-10 w-10 text-sm"
        : "h-8 w-8 text-xs";
  if (member.icon_url) {
    return (
      <img
        src={member.icon_url}
        alt={member.nickname}
        className={cn(dim, "rounded-full object-cover shrink-0")}
      />
    );
  }
  return (
    <span
      className={cn(
        dim,
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground",
      )}
    >
      {member.nickname.charAt(0)}
    </span>
  );
}

function CommentItem({
  comment,
  postId,
  members,
  currentUserId,
}: {
  comment: PostCommentResponse;
  postId: number;
  members: HomeMemberResponse[];
  currentUserId: number | undefined;
}) {
  const deleteComment = useDeleteComment();
  const member = members.find((m) => m.id === comment.user_id);
  const isOwn = currentUserId != null && comment.user_id === currentUserId;

  const handleDelete = async () => {
    try {
      await deleteComment.mutateAsync({ postId, commentId: comment.id });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="flex gap-2.5">
      {member ? (
        <MemberAvatar member={member} size="sm" />
      ) : (
        <span className="h-6 w-6 shrink-0 rounded-full bg-muted" />
      )}
      <div className="flex-1 min-w-0 rounded-xl bg-secondary/40 px-3 py-2">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-xs font-semibold">
            {member?.nickname ?? "不明"}
            {isOwn && (
              <span className="ml-1 text-[10px] text-primary font-normal">（自分）</span>
            )}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-muted-foreground">
              {format(parseISO(comment.created_at), "M月d日 HH:mm", { locale: ja })}
            </span>
            {isOwn && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteComment.isPending}
                className="text-[10px] text-destructive hover:underline disabled:opacity-50"
                aria-label="コメントを削除"
              >
                削除
              </button>
            )}
          </div>
        </div>
        <p className="text-xs leading-relaxed text-foreground">{comment.comment}</p>
      </div>
    </div>
  );
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const postId = parseInt(id!, 10);

  const { data: post, isLoading, isError } = usePost(postId);
  const { data: members = [] } = useHomeMembers();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const toggleLike = useToggleLike();
  const addComment = useAddComment();
  const deletePost = useDeletePost();

  const [commentText, setCommentText] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const author = post ? members.find((m) => m.id === post.created_by) : undefined;
  const isOwn = currentUserId != null && post?.created_by === currentUserId;

  const handleToggleLike = () => {
    toggleLike.mutate(postId, {
      onError: (err) => toast.error(getErrorMessage(err)),
    });
  };

  const handleAddComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    try {
      await addComment.mutateAsync({ postId, comment: text });
      setCommentText("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    try {
      await deletePost.mutateAsync(postId);
      toast.success("投稿を削除しました");
      navigate("/posts");
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleteConfirm(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommentText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="読み込み中" />
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          投稿の取得に失敗しました
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
          onClick={() => navigate("/posts")}
          className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-label="投稿一覧に戻る"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-xl font-semibold">投稿詳細</h1>
        {isOwn && (
          <DotsMenu
            onEdit={() => navigate(`/posts/${postId}/edit`)}
            onDelete={() => setDeleteConfirm(true)}
          />
        )}
      </div>

      {/* Post body */}
      <div className="rounded-xl border border-border bg-card shadow-sm dark:shadow-none overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          {/* Author row */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              {author ? (
                <MemberAvatar member={author} size="lg" />
              ) : (
                <span className="h-10 w-10 shrink-0 rounded-full bg-muted" />
              )}
              <div>
                <p className="text-sm font-semibold">{author?.nickname ?? "不明"}</p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(post.created_at), "yyyy年M月d日 HH:mm", { locale: ja })}
                </p>
              </div>
            </div>
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-3">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-primary"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Content */}
          <div
            className="text-sm leading-relaxed text-foreground [&_p]:mb-2 [&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_li]:mb-1 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_a]:text-primary [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Images */}
          {post.picture_urls.length > 0 && (
            <div
              className={cn(
                "mt-3 grid gap-1.5 overflow-hidden rounded-lg",
                post.picture_urls.length === 1 ? "grid-cols-1" : "grid-cols-2",
              )}
            >
              {post.picture_urls.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  aria-label={`投稿画像 ${i + 1} を拡大`}
                  className="block w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <img
                    src={url}
                    alt={`投稿画像 ${i + 1}`}
                    className={cn(
                      "w-full object-cover transition-opacity hover:opacity-90",
                      post.picture_urls.length === 1 ? "max-h-80" : "h-40",
                    )}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Delete confirm */}
        {deleteConfirm && (
          <div className="border-t border-destructive/30 bg-destructive/5 px-4 py-3 space-y-2">
            <p className="text-xs text-center text-destructive font-medium">
              この投稿を削除しますか？この操作は元に戻せません。
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 rounded-lg border border-border py-1.5 text-xs font-medium hover:bg-muted"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deletePost.isPending}
                className="flex-1 rounded-lg bg-destructive py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60 flex items-center justify-center"
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

        {/* Like & comment stats */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border bg-secondary/20">
          <button
            type="button"
            onClick={handleToggleLike}
            disabled={toggleLike.isPending}
            aria-pressed={post.is_liked}
            aria-label={post.is_liked ? "いいねを取り消す" : "いいねする"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              post.is_liked
                ? "border-red-200 bg-red-50 text-red-500 dark:border-red-900 dark:bg-red-950/30"
                : "border-border bg-background text-muted-foreground hover:border-red-200 hover:text-red-400",
            )}
          >
            {post.is_liked ? "❤️" : "🤍"} いいね · {post.like_count}
          </button>
          <span className="text-xs text-muted-foreground">
            💬 {post.comments.length}件のコメント
          </span>
        </div>
      </div>

      {/* Comments */}
      <div className="rounded-xl border border-border bg-card shadow-sm dark:shadow-none overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-muted-foreground">コメント</h2>
        </div>

        {post.comments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            コメントはまだありません
          </p>
        ) : (
          <div className="px-4 py-3 space-y-3">
            {post.comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                postId={postId}
                members={members}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}

        {/* Comment input */}
        <div className="flex gap-2.5 items-end px-4 py-3 border-t border-border">
          {(() => {
            const me = members.find((m) => m.id === currentUserId);
            return me ? (
              <MemberAvatar member={me} size="sm" />
            ) : (
              <span className="h-6 w-6 shrink-0 rounded-full bg-muted" />
            );
          })()}
          <textarea
            ref={textareaRef}
            value={commentText}
            onChange={handleTextareaChange}
            placeholder="コメントを追加…"
            rows={1}
            className="flex-1 resize-none overflow-hidden rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddComment();
            }}
          />
          <button
            type="button"
            onClick={handleAddComment}
            disabled={!commentText.trim() || addComment.isPending}
            className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
          >
            {addComment.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              "送信"
            )}
          </button>
        </div>
      </div>
    </div>

    {lightboxIndex !== null && post.picture_urls.length > 0 && (
      <Lightbox
        urls={post.picture_urls}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    )}
    </>
  );
}

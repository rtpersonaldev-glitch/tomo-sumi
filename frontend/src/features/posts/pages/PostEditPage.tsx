import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import { Loader2, Bold, Italic, List, ListOrdered, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { usePost, useCreatePost, useUpdatePost } from "../hooks/usePost";

const MAX_IMAGES = 5;

export default function PostEditPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const postId = id ? parseInt(id, 10) : undefined;

  const { data: existing, isLoading: loadingExisting } = usePost(postId, isEdit);
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();

  /* ── Tiptap editor ─────────────────────────────────────────── */
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "今日の出来事を書いてみましょう…" }),
    ],
    editorProps: {
      attributes: {
        class:
          "min-h-[160px] px-4 py-3 text-sm text-foreground outline-none leading-relaxed",
      },
    },
  });

  useEffect(() => {
    if (isEdit && existing && editor && !editor.isDestroyed) {
      editor.commands.setContent(existing.content);
    }
  }, [existing, isEdit, editor]);

  /* ── Image cropper ─────────────────────────────────────────── */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<any>(null);
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);
  const [croppedFiles, setCroppedFiles] = useState<File[]>([]);
  const [croppedPreviews, setCroppedPreviews] = useState<string[]>([]);

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

  const handleRemoveImage = (index: number) => {
    URL.revokeObjectURL(croppedPreviews[index]);
    setCroppedFiles((prev) => prev.filter((_, i) => i !== index));
    setCroppedPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const isPending = createPost.isPending || updatePost.isPending;

  const handleSubmit = async () => {
    if (!editor) return;
    const content = editor.getHTML();
    if (!content || content === "<p></p>") {
      toast.error("内容を入力してください");
      return;
    }
    try {
      if (isEdit && postId) {
        await updatePost.mutateAsync({ id: postId, content });
        toast.success("投稿を更新しました");
      } else {
        await createPost.mutateAsync({ content, images: croppedFiles });
        toast.success("投稿を作成しました");
      }
      navigate("/posts");
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
          onClick={() => navigate(isEdit ? `/posts/${postId}` : "/posts")}
          className="text-sm text-primary hover:underline"
          aria-label="キャンセルして戻る"
        >
          ‹ キャンセル
        </button>
        <h1 className="text-xl font-semibold">{isEdit ? "投稿編集" : "投稿作成"}</h1>
      </div>

      {/* Editor card */}
      <div className="rounded-xl border border-border bg-card shadow-sm dark:shadow-none overflow-hidden">
        {/* Toolbar */}
        {editor && (
          <div
            className="flex gap-1 px-3 py-2 border-b border-border bg-secondary/30"
            role="toolbar"
            aria-label="テキスト書式"
          >
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              aria-pressed={editor.isActive("bold")}
              aria-label="太字"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded border text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                editor.isActive("bold")
                  ? "border-primary bg-secondary text-primary"
                  : "border-border bg-background text-foreground hover:border-primary/40",
              )}
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              aria-pressed={editor.isActive("italic")}
              aria-label="斜体"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded border text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                editor.isActive("italic")
                  ? "border-primary bg-secondary text-primary"
                  : "border-border bg-background text-foreground hover:border-primary/40",
              )}
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              aria-pressed={editor.isActive("bulletList")}
              aria-label="箇条書き"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded border text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                editor.isActive("bulletList")
                  ? "border-primary bg-secondary text-primary"
                  : "border-border bg-background text-foreground hover:border-primary/40",
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              aria-pressed={editor.isActive("orderedList")}
              aria-label="番号付きリスト"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded border text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                editor.isActive("orderedList")
                  ? "border-primary bg-secondary text-primary"
                  : "border-border bg-background text-foreground hover:border-primary/40",
              )}
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Editor area */}
        <EditorContent
          editor={editor}
          className="[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ml-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ml-5 [&_.ProseMirror_li]:mb-1 [&_.ProseMirror_strong]:font-bold [&_.ProseMirror_em]:italic [&_.ProseMirror_p]:mb-1"
        />
      </div>

      {/* Image section (create mode only) */}
      {!isEdit && (
        <div className="rounded-xl border border-border bg-card shadow-sm dark:shadow-none p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              画像
              <span className="ml-1.5 text-xs text-muted-foreground">
                （{croppedFiles.length}/{MAX_IMAGES}枚・各10MBまで）
              </span>
            </span>
          </div>

          <div className="flex gap-2 flex-wrap">
            {croppedPreviews.map((url, i) => (
              <div
                key={url}
                className="relative h-18 w-18 overflow-hidden rounded-lg border border-border"
                style={{ width: 72, height: 72 }}
              >
                <img src={url} alt={`追加画像 ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(i)}
                  aria-label={`画像 ${i + 1} を削除`}
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {croppedFiles.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-[72px] w-[72px] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-primary hover:border-primary/60 hover:bg-secondary/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="画像を追加"
              >
                <span className="text-xl leading-none">＋</span>
                <span className="text-[10px] font-semibold">追加</span>
              </button>
            )}
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
      )}

      {/* Edit mode: show existing images read-only */}
      {isEdit && existing && existing.picture_urls.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm dark:shadow-none p-4 space-y-2">
          <span className="text-sm font-medium text-muted-foreground">
            既存画像（変更不可）
          </span>
          <div className="flex gap-2 flex-wrap">
            {existing.picture_urls.map((url, i) => (
              <img
                key={url}
                src={url}
                alt={`既存画像 ${i + 1}`}
                className="h-16 w-16 rounded-lg object-cover border border-border"
              />
            ))}
          </div>
        </div>
      )}

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
                className="text-muted-foreground hover:text-foreground transition-colors"
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
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleCrop}
                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-all"
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
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            処理中...
          </>
        ) : isEdit ? (
          "更新する"
        ) : (
          "投稿する"
        )}
      </button>
    </div>
  );
}

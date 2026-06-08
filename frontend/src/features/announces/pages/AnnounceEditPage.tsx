import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useAnnounce, useCreateAnnounce, useUpdateAnnounce } from "../hooks/useAnnounce";
import type { AnnounceFormValues } from "../types";

const schema = z.object({
  title: z
    .string()
    .min(1, "タイトルを入力してください")
    .max(50, "50文字以内で入力してください"),
  content: z
    .string()
    .min(1, "内容を入力してください")
    .max(300, "300文字以内で入力してください"),
  priority: z.enum(["high", "medium", "low"]),
  end_date: z.string().min(1, "期限日を選択してください"),
});

const PRIORITIES = [
  {
    value: "high" as const,
    label: "🔴 高",
    chipClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    activeRing: "ring-2 ring-red-400",
  },
  {
    value: "medium" as const,
    label: "🟡 中",
    chipClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    activeRing: "ring-2 ring-amber-400",
  },
  {
    value: "low" as const,
    label: "⚪ 低",
    chipClass: "bg-muted text-muted-foreground",
    activeRing: "ring-2 ring-border",
  },
] as const;

const inputBase =
  "w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export default function AnnounceEditPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const announceId = id ? parseInt(id, 10) : undefined;

  const { data: existing, isLoading: loadingExisting } = useAnnounce(announceId, isEdit);
  const createAnnounce = useCreateAnnounce();
  const updateAnnounce = useUpdateAnnounce();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AnnounceFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      content: "",
      priority: "medium",
      end_date: "",
    },
  });

  useEffect(() => {
    if (isEdit && existing) {
      setValue("title", existing.title);
      setValue("content", existing.content);
      setValue("priority", existing.priority);
      setValue("end_date", existing.end_date);
    }
  }, [existing, isEdit, setValue]);

  const priority = watch("priority");
  const titleValue = watch("title");
  const contentValue = watch("content");
  const isPending = createAnnounce.isPending || updateAnnounce.isPending;

  const onSubmit = async (values: AnnounceFormValues) => {
    try {
      if (isEdit && announceId) {
        await updateAnnounce.mutateAsync({ id: announceId, body: values });
        toast.success("お知らせを更新しました");
        navigate(`/announces/${announceId}`);
      } else {
        const created = await createAnnounce.mutateAsync(values);
        toast.success("お知らせを作成しました");
        navigate(`/announces/${created.id}`);
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
          onClick={() =>
            navigate(isEdit && announceId ? `/announces/${announceId}` : "/announces")
          }
          className="text-sm text-primary hover:underline"
          aria-label="キャンセルして戻る"
        >
          ‹ キャンセル
        </button>
        <h1 className="text-xl font-semibold">
          {isEdit ? "お知らせ編集" : "お知らせ作成"}
        </h1>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-xl border border-border bg-card p-5 space-y-5 shadow-sm dark:shadow-none"
        noValidate
      >
        {/* Title */}
        <div className="space-y-1.5">
          <label htmlFor="title" className="text-sm font-medium">
            タイトル <span className="text-destructive" aria-hidden>*</span>
          </label>
          <input
            id="title"
            type="text"
            placeholder="例: 家賃支払いについて"
            aria-describedby={errors.title ? "title-error" : undefined}
            aria-invalid={!!errors.title}
            className={cn(inputBase, errors.title ? "border-destructive" : "border-input")}
            {...register("title")}
          />
          <div className="flex items-center justify-between">
            {errors.title ? (
              <span
                id="title-error"
                role="alert"
                className="flex items-center gap-1 text-xs text-destructive"
              >
                <span aria-hidden>⚠</span>
                {errors.title.message}
              </span>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted-foreground">{titleValue.length} / 50</span>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <label htmlFor="content" className="text-sm font-medium">
            内容 <span className="text-destructive" aria-hidden>*</span>
          </label>
          <textarea
            id="content"
            rows={5}
            placeholder="お知らせの詳細内容を入力してください..."
            aria-describedby={errors.content ? "content-error" : undefined}
            aria-invalid={!!errors.content}
            className={cn(
              inputBase,
              "resize-none",
              errors.content ? "border-destructive" : "border-input",
            )}
            {...register("content")}
          />
          <div className="flex items-center justify-between">
            {errors.content ? (
              <span
                id="content-error"
                role="alert"
                className="flex items-center gap-1 text-xs text-destructive"
              >
                <span aria-hidden>⚠</span>
                {errors.content.message}
              </span>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted-foreground">{contentValue.length} / 300</span>
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-1.5">
          <span className="text-sm font-medium">
            優先度 <span className="text-destructive" aria-hidden>*</span>
          </span>
          <div className="flex gap-2" role="group" aria-label="優先度を選択">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setValue("priority", p.value)}
                aria-pressed={priority === p.value}
                className={cn(
                  "flex-1 rounded-lg py-2 text-sm font-semibold transition-all",
                  p.chipClass,
                  priority === p.value ? p.activeRing : "opacity-60",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* End date */}
        <div className="space-y-1.5">
          <label htmlFor="end_date" className="text-sm font-medium">
            期限日 <span className="text-destructive" aria-hidden>*</span>
          </label>
          <input
            id="end_date"
            type="date"
            aria-describedby={errors.end_date ? "end-date-error" : "end-date-hint"}
            aria-invalid={!!errors.end_date}
            className={cn(inputBase, errors.end_date ? "border-destructive" : "border-input")}
            {...register("end_date")}
          />
          {errors.end_date ? (
            <span
              id="end-date-error"
              role="alert"
              className="flex items-center gap-1 text-xs text-destructive"
            >
              <span aria-hidden>⚠</span>
              {errors.end_date.message}
            </span>
          ) : (
            <p id="end-date-hint" className="text-xs text-muted-foreground">
              この日以降は一覧から非表示になります
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
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
            "作成する"
          )}
        </button>
      </form>
    </div>
  );
}

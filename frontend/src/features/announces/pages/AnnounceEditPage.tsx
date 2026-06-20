import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useHomeMembers } from "@/features/home/hooks/useHome";
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
  recipient_ids: z.array(z.number()),
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
  const { data: homeMembers = [] } = useHomeMembers();
  const createAnnounce = useCreateAnnounce();
  const updateAnnounce = useUpdateAnnounce();

  const [recipientMode, setRecipientMode] = useState<"all" | "specific">("all");

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
      recipient_ids: [],
    },
  });

  useEffect(() => {
    if (isEdit && existing) {
      setValue("title", existing.title);
      setValue("content", existing.content);
      setValue("priority", existing.priority);
      setValue("end_date", existing.end_date);
      setValue("recipient_ids", existing.recipient_ids);
      if (existing.recipient_ids.length > 0) {
        setRecipientMode("specific");
      }
    }
  }, [existing, isEdit, setValue]);

  const priority = watch("priority");
  const titleValue = watch("title");
  const contentValue = watch("content");
  const recipientIds = watch("recipient_ids");
  const isPending = createAnnounce.isPending || updateAnnounce.isPending;

  const toggleRecipient = (uid: number) => {
    const next = recipientIds.includes(uid)
      ? recipientIds.filter((x) => x !== uid)
      : [...recipientIds, uid];
    setValue("recipient_ids", next);
  };

  const onSubmit = async (values: AnnounceFormValues) => {
    const payload: AnnounceFormValues = {
      ...values,
      recipient_ids: recipientMode === "specific" ? values.recipient_ids : [],
    };
    try {
      if (isEdit && announceId) {
        await updateAnnounce.mutateAsync({ id: announceId, body: payload });
        toast.success("お知らせを更新しました");
        navigate(`/announces/${announceId}`);
      } else {
        const created = await createAnnounce.mutateAsync(payload);
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
              <span id="title-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
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
              <span id="content-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
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
            <span id="end-date-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
              <span aria-hidden>⚠</span>
              {errors.end_date.message}
            </span>
          ) : (
            <p id="end-date-hint" className="text-xs text-muted-foreground">
              この日以降は一覧から非表示になります
            </p>
          )}
        </div>

        {/* Recipients */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            宛先
          </p>
          {/* Toggle */}
          <div
            className="flex rounded-lg border border-border bg-secondary/30 p-1 gap-1"
            role="group"
            aria-label="宛先の種類を選択"
          >
            <button
              type="button"
              onClick={() => {
                setRecipientMode("all");
                setValue("recipient_ids", []);
              }}
              aria-pressed={recipientMode === "all"}
              className={cn(
                "flex-1 rounded-md py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                recipientMode === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              全員
            </button>
            <button
              type="button"
              onClick={() => setRecipientMode("specific")}
              aria-pressed={recipientMode === "specific"}
              className={cn(
                "flex-1 rounded-md py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                recipientMode === "specific"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              個人指定
            </button>
          </div>

          {recipientMode === "all" ? (
            <p className="text-xs text-muted-foreground">ホーム全員に表示されます</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 pt-1" role="group" aria-label="宛先メンバーを選択">
                {homeMembers.map((m) => {
                  const selected = recipientIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleRecipient(m.id)}
                      aria-pressed={selected}
                      className="flex flex-col items-center gap-1 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div
                        className={cn(
                          "rounded-full p-0.5",
                          selected ? "ring-2 ring-primary ring-offset-1" : "",
                        )}
                      >
                        {m.icon_url ? (
                          <img
                            src={m.icon_url}
                            alt={m.nickname}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                            {m.nickname.charAt(0)}
                          </div>
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-[10px]",
                          selected ? "font-semibold text-primary" : "text-muted-foreground",
                        )}
                      >
                        {m.nickname}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                選択した人のみにお知らせが表示されます
              </p>
            </>
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

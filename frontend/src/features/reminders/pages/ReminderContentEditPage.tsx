import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import {
  useReminderContent,
  useCreateReminderContent,
  useUpdateReminderContent,
} from "../hooks/useReminder";

const REPEAT_OPTIONS = [
  { value: "", label: "なし" },
  { value: "daily", label: "毎日" },
  { value: "weekly", label: "毎週" },
  { value: "monthly", label: "毎月" },
] as const;

const schema = z.object({
  title: z
    .string()
    .min(1, "タイトルを入力してください")
    .max(50, "50文字以内で入力してください"),
  memo: z.string().max(100, "100文字以内で入力してください"),
  date: z.string(),
  time: z.string(),
  repeat: z.string(),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const inputBase =
  "w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export default function ReminderContentEditPage() {
  const { id, contentId } = useParams<{ id?: string; contentId?: string }>();
  const navigate = useNavigate();

  const isEdit = !!contentId;
  const reminderId = id ? parseInt(id, 10) : undefined;
  const parsedContentId = contentId ? parseInt(contentId, 10) : undefined;

  const { data: existing, isLoading: loadingExisting } = useReminderContent(
    parsedContentId,
    isEdit,
  );
  const createContent = useCreateReminderContent();
  const updateContent = useUpdateReminderContent();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      memo: "",
      date: "",
      time: "",
      repeat: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (isEdit && existing) {
      setValue("title", existing.title);
      setValue("memo", existing.memo);
      setValue("date", existing.date ?? "");
      setValue("time", existing.time ?? "");
      setValue("repeat", existing.repeat ?? "");
      setValue("is_active", existing.is_active);
    }
  }, [existing, isEdit, setValue]);

  const titleValue = watch("title");
  const memoValue = watch("memo");
  const repeatValue = watch("repeat");
  const isActiveValue = watch("is_active");
  const isPending = createContent.isPending || updateContent.isPending;

  const onSubmit = async (values: FormValues) => {
    const body = {
      title: values.title,
      memo: values.memo,
      date: values.date || null,
      time: values.time || null,
      repeat: values.repeat || null,
      is_active: values.is_active,
    };

    try {
      if (isEdit && parsedContentId && existing) {
        await updateContent.mutateAsync({
          contentId: parsedContentId,
          reminderId: existing.reminder_id,
          body,
        });
        toast.success("項目を更新しました");
        navigate("/reminders");
      } else if (!isEdit && reminderId) {
        await createContent.mutateAsync({ reminderId, body });
        toast.success("項目を追加しました");
        navigate("/reminders");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleCancel = () => {
    if (reminderId) {
      navigate("/reminders");
    } else {
      navigate("/reminders");
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
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleCancel}
          className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-label="キャンセルして戻る"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold">
          {isEdit ? "項目編集" : "項目追加"}
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
            placeholder="例: 起きる"
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

        {/* Memo */}
        <div className="space-y-1.5">
          <label htmlFor="memo" className="text-sm font-medium">メモ</label>
          <textarea
            id="memo"
            placeholder="任意のメモ…"
            rows={2}
            className={cn(
              inputBase,
              "resize-none",
              errors.memo ? "border-destructive" : "border-input",
            )}
            {...register("memo")}
          />
          <div className="flex items-center justify-between">
            {errors.memo ? (
              <span role="alert" className="flex items-center gap-1 text-xs text-destructive">
                <span aria-hidden>⚠</span>
                {errors.memo.message}
              </span>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted-foreground">{memoValue.length} / 100</span>
          </div>
        </div>

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="date" className="text-sm font-medium">日付</label>
            <input
              id="date"
              type="date"
              className={cn(inputBase, "border-input")}
              {...register("date")}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="time" className="text-sm font-medium">通知時刻</label>
            <input
              id="time"
              type="time"
              className={cn(inputBase, "border-input")}
              {...register("time")}
            />
          </div>
        </div>

        {/* Repeat */}
        <div className="space-y-2">
          <span className="text-sm font-medium">繰り返し</span>
          <div className="flex gap-2 flex-wrap" role="group" aria-label="繰り返しパターン">
            {REPEAT_OPTIONS.map((opt) => (
              <Controller
                key={opt.value}
                control={control}
                name="repeat"
                render={({ field }) => (
                  <button
                    type="button"
                    onClick={() => field.onChange(opt.value)}
                    aria-pressed={repeatValue === opt.value}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      repeatValue === opt.value
                        ? "border-primary bg-secondary text-primary"
                        : "border-border bg-background text-foreground hover:border-primary/40",
                    )}
                  >
                    {opt.label}
                  </button>
                )}
              />
            ))}
          </div>
        </div>

        <hr className="border-border" />

        {/* is_active toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">有効にする</p>
            <p className="text-xs text-muted-foreground">
              {isActiveValue ? "現在: 有効" : "現在: 無効"}
            </p>
          </div>
          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <button
                type="button"
                role="switch"
                aria-checked={field.value}
                onClick={() => field.onChange(!field.value)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  field.value ? "bg-primary" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    field.value ? "translate-x-6" : "translate-x-1",
                  )}
                />
              </button>
            )}
          />
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
            "追加する"
          )}
        </button>
      </form>
    </div>
  );
}

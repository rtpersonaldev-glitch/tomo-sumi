import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useSchedule, useCreateSchedule, useUpdateSchedule } from "../hooks/useSchedule";

const schema = z
  .object({
    title: z
      .string()
      .min(1, "タイトルを入力してください")
      .max(100, "100文字以内で入力してください"),
    memo: z.string().max(100, "100文字以内で入力してください"),
    start_day: z.string().min(1, "開始日時を選択してください"),
    end_day: z.string().min(1, "終了日時を選択してください"),
  })
  .refine((v) => !v.start_day || !v.end_day || v.end_day >= v.start_day, {
    message: "終了日時は開始日時より後に設定してください",
    path: ["end_day"],
  });

type FormValues = z.infer<typeof schema>;

const inputBase =
  "w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

const toISO = (local: string) => new Date(local).toISOString();
const toLocal = (iso: string) => format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");

export default function ScheduleEditPage() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const scheduleId = id ? parseInt(id, 10) : undefined;

  const { data: existing, isLoading: loadingExisting } = useSchedule(scheduleId, isEdit);
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();

  const presetDate = searchParams.get("date");
  const defaultStart = presetDate ? `${presetDate}T09:00` : "";
  const defaultEnd = presetDate ? `${presetDate}T10:00` : "";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", memo: "", start_day: defaultStart, end_day: defaultEnd },
  });

  useEffect(() => {
    if (isEdit && existing) {
      setValue("title", existing.title);
      setValue("memo", existing.memo);
      setValue("start_day", toLocal(existing.start_day));
      setValue("end_day", toLocal(existing.end_day));
    }
  }, [existing, isEdit, setValue]);

  const titleValue = watch("title");
  const memoValue = watch("memo");
  const isPending = createSchedule.isPending || updateSchedule.isPending;

  const onSubmit = async (values: FormValues) => {
    const body = {
      title: values.title,
      memo: values.memo,
      start_day: toISO(values.start_day),
      end_day: toISO(values.end_day),
    };
    try {
      if (isEdit && scheduleId) {
        await updateSchedule.mutateAsync({ id: scheduleId, body });
        toast.success("スケジュールを更新しました");
        navigate(`/schedules/${scheduleId}`);
      } else {
        const created = await createSchedule.mutateAsync(body);
        toast.success("スケジュールを作成しました");
        navigate(`/schedules/${created.id}`);
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
            navigate(isEdit && scheduleId ? `/schedules/${scheduleId}` : "/schedules")
          }
          className="text-sm text-primary hover:underline"
          aria-label="キャンセルして戻る"
        >
          ‹ キャンセル
        </button>
        <h1 className="text-xl font-semibold">
          {isEdit ? "スケジュール編集" : "スケジュール作成"}
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
            placeholder="例: 家族会議"
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
            <span className="text-xs text-muted-foreground">{titleValue.length} / 100</span>
          </div>
        </div>

        {/* Memo */}
        <div className="space-y-1.5">
          <label htmlFor="memo" className="text-sm font-medium">
            メモ
          </label>
          <textarea
            id="memo"
            rows={3}
            placeholder="場所・備考など（任意）"
            aria-describedby={errors.memo ? "memo-error" : undefined}
            aria-invalid={!!errors.memo}
            className={cn(
              inputBase,
              "resize-none",
              errors.memo ? "border-destructive" : "border-input",
            )}
            {...register("memo")}
          />
          <div className="flex items-center justify-between">
            {errors.memo ? (
              <span
                id="memo-error"
                role="alert"
                className="flex items-center gap-1 text-xs text-destructive"
              >
                <span aria-hidden>⚠</span>
                {errors.memo.message}
              </span>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted-foreground">{memoValue.length} / 100</span>
          </div>
        </div>

        {/* Start datetime */}
        <div className="space-y-1.5">
          <label htmlFor="start_day" className="text-sm font-medium">
            開始日時 <span className="text-destructive" aria-hidden>*</span>
          </label>
          <input
            id="start_day"
            type="datetime-local"
            aria-describedby={errors.start_day ? "start-error" : undefined}
            aria-invalid={!!errors.start_day}
            className={cn(inputBase, errors.start_day ? "border-destructive" : "border-input")}
            {...register("start_day")}
          />
          {errors.start_day && (
            <span
              id="start-error"
              role="alert"
              className="flex items-center gap-1 text-xs text-destructive"
            >
              <span aria-hidden>⚠</span>
              {errors.start_day.message}
            </span>
          )}
        </div>

        {/* End datetime */}
        <div className="space-y-1.5">
          <label htmlFor="end_day" className="text-sm font-medium">
            終了日時 <span className="text-destructive" aria-hidden>*</span>
          </label>
          <input
            id="end_day"
            type="datetime-local"
            aria-describedby={errors.end_day ? "end-error" : "end-hint"}
            aria-invalid={!!errors.end_day}
            className={cn(inputBase, errors.end_day ? "border-destructive" : "border-input")}
            {...register("end_day")}
          />
          {errors.end_day ? (
            <span
              id="end-error"
              role="alert"
              className="flex items-center gap-1 text-xs text-destructive"
            >
              <span aria-hidden>⚠</span>
              {errors.end_day.message}
            </span>
          ) : (
            <p id="end-hint" className="text-xs text-muted-foreground">
              開始日時より後に設定してください
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

import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import {
  useReminder,
  useCreateReminder,
  useUpdateReminder,
} from "../hooks/useReminder";

const schema = z.object({
  list_name: z
    .string()
    .min(1, "グループ名を入力してください")
    .max(50, "50文字以内で入力してください"),
});

type FormValues = z.infer<typeof schema>;

const inputBase =
  "w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export default function ReminderGroupEditPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const reminderId = id ? parseInt(id, 10) : undefined;

  const { data: existing, isLoading: loadingExisting } = useReminder(reminderId, isEdit);
  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { list_name: "" },
  });

  useEffect(() => {
    if (isEdit && existing) {
      setValue("list_name", existing.list_name);
    }
  }, [existing, isEdit, setValue]);

  const nameValue = watch("list_name");
  const isPending = createReminder.isPending || updateReminder.isPending;

  const onSubmit = async (values: FormValues) => {
    const body = { list_name: values.list_name, complete_flag: false };
    try {
      if (isEdit && reminderId) {
        await updateReminder.mutateAsync({ id: reminderId, body });
        toast.success("グループを更新しました");
        navigate("/reminders");
      } else {
        await createReminder.mutateAsync(body);
        toast.success("グループを作成しました");
        navigate("/reminders");
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
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/reminders")}
          className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-label="キャンセルして戻る"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold">
          {isEdit ? "グループ編集" : "グループ作成"}
        </h1>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-xl border border-border bg-card p-5 space-y-5 shadow-sm dark:shadow-none"
        noValidate
      >
        <div className="space-y-1.5">
          <label htmlFor="list_name" className="text-sm font-medium">
            グループ名 <span className="text-destructive" aria-hidden>*</span>
          </label>
          <input
            id="list_name"
            type="text"
            placeholder="例: 朝の支度"
            aria-describedby={errors.list_name ? "list-name-error" : undefined}
            aria-invalid={!!errors.list_name}
            className={cn(inputBase, errors.list_name ? "border-destructive" : "border-input")}
            {...register("list_name")}
          />
          <div className="flex items-center justify-between">
            {errors.list_name ? (
              <span
                id="list-name-error"
                role="alert"
                className="flex items-center gap-1 text-xs text-destructive"
              >
                <span aria-hidden>⚠</span>
                {errors.list_name.message}
              </span>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted-foreground">{nameValue.length} / 50</span>
          </div>
        </div>

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

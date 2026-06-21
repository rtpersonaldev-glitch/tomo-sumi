import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useTodo, useCreateTodo, useUpdateTodo } from "../hooks/useTodo";

const schema = z.object({
  title: z
    .string()
    .min(1, "リスト名を入力してください")
    .max(50, "50文字以内で入力してください"),
  contents: z.array(
    z.object({
      content: z
        .string()
        .min(1, "内容を入力してください")
        .max(50, "50文字以内で入力してください"),
      check_flag: z.boolean(),
      checked_by: z.number().nullable(),
    }),
  ),
});

type FormValues = z.infer<typeof schema>;

const inputBase =
  "w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export default function TodoEditPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const todoId = id ? parseInt(id, 10) : undefined;

  const { data: existing, isLoading: loadingExisting } = useTodo(todoId, isEdit);
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", contents: [] },
  });

  const { fields, append, remove, move } = useFieldArray({ control, name: "contents" });

  useEffect(() => {
    if (isEdit && existing) {
      setValue("title", existing.title);
      setValue(
        "contents",
        existing.contents.map((c) => ({
          content: c.content,
          check_flag: c.check_flag,
          checked_by: c.checked_by,
        })),
      );
    }
  }, [existing, isEdit, setValue]);

  const titleValue = watch("title");
  const isPending = createTodo.isPending || updateTodo.isPending;

  const onSubmit = async (values: FormValues) => {
    const allChecked =
      values.contents.length > 0 && values.contents.every((c) => c.check_flag);
    const body = {
      title: values.title,
      complete_flag: allChecked,
      contents: values.contents,
    };
    try {
      if (isEdit && todoId) {
        await updateTodo.mutateAsync({ id: todoId, body });
        toast.success("TODOリストを更新しました");
        navigate(`/todos/${todoId}`);
      } else {
        const created = await createTodo.mutateAsync(body);
        toast.success("TODOリストを作成しました");
        navigate(`/todos/${created.id}`);
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
            navigate(isEdit && todoId ? `/todos/${todoId}` : "/todos")
          }
          className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-label="キャンセルして戻る"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold">
          {isEdit ? "TODOリスト編集" : "TODOリスト作成"}
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
            リスト名 <span className="text-destructive" aria-hidden>*</span>
          </label>
          <input
            id="title"
            type="text"
            placeholder="例: 今週の買い物"
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

        {/* Contents */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">項目</span>
            <span className="text-xs text-muted-foreground">{fields.length} 件</span>
          </div>

          {fields.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">まだ項目がありません</p>
          )}

          <ul className="space-y-2" role="list">
            {fields.map((field, index) => (
              <li key={field.id} className="flex items-center gap-2">
                {/* Hidden fields to preserve check state */}
                <input type="hidden" {...register(`contents.${index}.check_flag`)} />
                <input type="hidden" {...register(`contents.${index}.checked_by`)} />

                <input
                  type="text"
                  placeholder={`項目 ${index + 1}`}
                  aria-label={`項目 ${index + 1}`}
                  aria-invalid={!!errors.contents?.[index]?.content}
                  className={cn(
                    "flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-all placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
                    errors.contents?.[index]?.content
                      ? "border-destructive"
                      : "border-input",
                  )}
                  {...register(`contents.${index}.content`)}
                />

                <button
                  type="button"
                  onClick={() => move(index, Math.max(0, index - 1))}
                  disabled={index === 0}
                  aria-label={`項目 ${index + 1} を上へ`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-sm transition-colors hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, Math.min(fields.length - 1, index + 1))}
                  disabled={index === fields.length - 1}
                  aria-label={`項目 ${index + 1} を下へ`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-sm transition-colors hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`項目 ${index + 1} を削除`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-background text-sm text-destructive transition-colors hover:bg-destructive/10 dark:border-red-900"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {errors.contents && (
            <p role="alert" className="text-xs text-destructive">
              {errors.contents.root?.message ?? "項目に入力エラーがあります"}
            </p>
          )}

          <button
            type="button"
            onClick={() => append({ content: "", check_flag: false, checked_by: null })}
            className="w-full rounded-lg border-2 border-dashed border-primary/50 py-2 text-xs font-semibold text-primary hover:border-primary transition-colors"
          >
            ＋ 項目を追加
          </button>
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

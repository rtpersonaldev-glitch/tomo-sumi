import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSelectHome } from "@/features/auth/hooks/useAuth";
import { getErrorMessage } from "@/utils/error";
import { useCreateHome } from "../hooks/useHome";

const schema = z.object({
  name: z
    .string()
    .min(1, "ホーム名を入力してください")
    .max(50, "50文字以内で入力してください"),
});

type FormValues = z.infer<typeof schema>;

const inputBase =
  "w-full rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export default function HomeCreatePage() {
  const navigate = useNavigate();
  const createHome = useCreateHome();
  const selectHome = useSelectHome();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      const home = await createHome.mutateAsync(values.name.trim());
      selectHome.mutate(home.id);
    } catch {
      // createHome.error handles display
    }
  };

  const isPending = createHome.isPending || selectHome.isPending;

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm dark:shadow-none">
        <button
          type="button"
          onClick={() => navigate("/home-select")}
          className="mb-6 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-label="ホーム選択に戻る"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">ホームを作成</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            家族・同居人と共有する空間を作ります
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          {(createHome.error || selectHome.error) && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {getErrorMessage(createHome.error ?? selectHome.error)}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              ホーム名 <span className="text-destructive">*</span>
            </label>
            <input
              id="name"
              type="text"
              placeholder="例: 山田家"
              autoComplete="off"
              aria-describedby={errors.name ? "name-error" : undefined}
              aria-invalid={!!errors.name}
              className={`${inputBase} ${errors.name ? "border-destructive" : "border-input"}`}
              {...register("name")}
            />
            {errors.name ? (
              <span id="name-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
                <span aria-hidden>⚠</span>
                {errors.name.message}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">2〜50文字</span>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                作成中...
              </>
            ) : (
              "ホームを作成"
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate("/home-select")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            キャンセル
          </button>
        </form>
      </div>
    </div>
  );
}

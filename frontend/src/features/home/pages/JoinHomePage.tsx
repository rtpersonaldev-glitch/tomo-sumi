import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSelectHome } from "@/features/auth/hooks/useAuth";
import { getErrorMessage } from "@/utils/error";
import { useJoinHome } from "../hooks/useHome";

const schema = z.object({
  code: z
    .string()
    .min(1, "招待コードを入力してください")
    .max(64, "招待コードが長すぎます"),
});

type FormValues = z.infer<typeof schema>;

const inputBase =
  "w-full rounded-lg border bg-card text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export default function JoinHomePage() {
  const navigate = useNavigate();
  const joinHome = useJoinHome();
  const selectHome = useSelectHome();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      const home = await joinHome.mutateAsync(values.code.trim());
      selectHome.mutate(home.id);
    } catch {
      // joinHome.error handles display
    }
  };

  const isPending = joinHome.isPending || selectHome.isPending;

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm dark:shadow-none">
        <button
          type="button"
          onClick={() => navigate("/home-select")}
          className="mb-6 flex items-center gap-1 text-sm text-primary hover:underline"
          aria-label="ホーム選択に戻る"
        >
          ‹ 戻る
        </button>

        <div className="mb-8 text-center">
          <div className="mb-3 text-4xl" aria-hidden>🔑</div>
          <h1 className="text-2xl font-bold">ホームに参加</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            ホーム管理者から共有された招待コードを入力してください
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          {(joinHome.error || selectHome.error) && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {getErrorMessage(joinHome.error ?? selectHome.error)}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="code" className="text-sm font-medium">
              招待コード <span className="text-destructive">*</span>
            </label>
            <input
              id="code"
              type="text"
              placeholder="XXXXXXXXXXX"
              autoComplete="off"
              aria-describedby={errors.code ? "code-error" : undefined}
              aria-invalid={!!errors.code}
              className={`${inputBase} px-3 py-3 text-center font-mono text-xl tracking-widest ${
                errors.code ? "border-destructive" : "border-input"
              }`}
              {...register("code")}
            />
            {errors.code && (
              <span id="code-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
                <span aria-hidden>⚠</span>
                {errors.code.message}
              </span>
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
                参加中...
              </>
            ) : (
              "ホームに参加"
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

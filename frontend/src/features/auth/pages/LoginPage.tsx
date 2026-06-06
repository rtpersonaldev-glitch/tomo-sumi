import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useLogin } from "@/features/auth/hooks/useAuth";
import { getErrorMessage } from "@/utils/error";

const schema = z.object({
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "8文字以上で入力してください"),
});

type FormValues = z.infer<typeof schema>;

const inputBase =
  "w-full rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export default function LoginPage() {
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = (values: FormValues) => login.mutate(values);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px] rounded-2xl border border-border bg-card p-8 shadow-sm dark:shadow-none">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2.5">
          <div
            aria-hidden
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground"
          >
            T
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Tomo-sumi</h1>
          <p className="text-sm text-muted-foreground">家族の暮らしを、ひとつに。</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          {/* API エラーバナー */}
          {login.error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {getErrorMessage(login.error)}
            </div>
          )}

          {/* メールアドレス */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              aria-describedby={errors.email ? "email-error" : undefined}
              aria-invalid={!!errors.email}
              className={`${inputBase} ${errors.email ? "border-destructive" : "border-input"}`}
              {...register("email")}
            />
            {errors.email && (
              <span id="email-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
                <span aria-hidden="true">⚠</span>
                {errors.email.message}
              </span>
            )}
          </div>

          {/* パスワード */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-describedby={errors.password ? "password-error" : undefined}
              aria-invalid={!!errors.password}
              className={`${inputBase} ${errors.password ? "border-destructive" : "border-input"}`}
              {...register("password")}
            />
            {errors.password && (
              <span id="password-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
                <span aria-hidden="true">⚠</span>
                {errors.password.message}
              </span>
            )}
          </div>

          {/* 送信ボタン */}
          <button
            type="submit"
            disabled={login.isPending}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {login.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ログイン中...
              </>
            ) : (
              "ログイン"
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          アカウントをお持ちでない方は{" "}
          <Link to="/sign-up" className="font-medium text-primary hover:underline">
            新規登録
          </Link>
        </p>
      </div>
    </div>
  );
}

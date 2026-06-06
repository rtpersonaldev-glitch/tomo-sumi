import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useSignup } from "@/features/auth/hooks/useAuth";
import { getErrorMessage } from "@/utils/error";

const schema = z.object({
  nickname: z
    .string()
    .min(2, "2文字以上で入力してください")
    .max(20, "20文字以内で入力してください"),
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "8文字以上で入力してください"),
});

type FormValues = z.infer<typeof schema>;

const inputBase =
  "w-full rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = Math.min(Math.floor(password.length / 3), 4);
  const color = (i: number) => {
    if (i >= strength) return "bg-muted";
    if (strength === 1) return "bg-destructive";
    if (strength === 2) return "bg-accent";
    return "bg-primary";
  };
  return (
    <div className="flex gap-1" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${color(i)}`} />
      ))}
    </div>
  );
}

export default function SignupPage() {
  const signup = useSignup();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const password = watch("password", "");
  const onSubmit = (values: FormValues) => signup.mutate(values);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-[400px] rounded-2xl border border-border bg-card p-8 shadow-sm dark:shadow-none">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2.5">
          <div
            aria-hidden
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground"
          >
            T
          </div>
          <h1 className="text-2xl font-bold tracking-tight">アカウント作成</h1>
          <p className="text-sm text-muted-foreground">家族と一緒に使い始めましょう</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          {/* API エラーバナー */}
          {signup.error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {getErrorMessage(signup.error)}
            </div>
          )}

          {/* ニックネーム */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nickname" className="text-sm font-medium">
              ニックネーム
            </label>
            <input
              id="nickname"
              type="text"
              autoComplete="nickname"
              placeholder="例：太郎"
              aria-describedby={errors.nickname ? "nickname-error" : "nickname-hint"}
              aria-invalid={!!errors.nickname}
              className={`${inputBase} ${errors.nickname ? "border-destructive" : "border-input"}`}
              {...register("nickname")}
            />
            {errors.nickname ? (
              <span id="nickname-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
                <span aria-hidden="true">⚠</span>
                {errors.nickname.message}
              </span>
            ) : (
              <span id="nickname-hint" className="text-xs text-muted-foreground">
                家族に表示される名前です（2〜20文字）
              </span>
            )}
          </div>

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
              autoComplete="new-password"
              placeholder="8文字以上"
              aria-describedby={errors.password ? "password-error" : "password-hint"}
              aria-invalid={!!errors.password}
              className={`${inputBase} ${errors.password ? "border-destructive" : "border-input"}`}
              {...register("password")}
            />
            <PasswordStrengthBar password={password} />
            {errors.password ? (
              <span id="password-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
                <span aria-hidden="true">⚠</span>
                {errors.password.message}
              </span>
            ) : (
              <span id="password-hint" className="text-xs text-muted-foreground">
                英数字を組み合わせてください
              </span>
            )}
          </div>

          {/* 送信ボタン */}
          <button
            type="submit"
            disabled={signup.isPending}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signup.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                登録中...
              </>
            ) : (
              "アカウントを作成"
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          すでにアカウントをお持ちですか？{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}

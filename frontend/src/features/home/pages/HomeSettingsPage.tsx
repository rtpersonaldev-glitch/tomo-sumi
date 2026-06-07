import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useAuthStore } from "@/store/authStore";
import { getErrorMessage } from "@/utils/error";
import { useInvitationCode, useRefreshInvitationCode, useUpdateHome } from "../hooks/useHome";

const schema = z.object({
  name: z
    .string()
    .min(1, "ホーム名を入力してください")
    .max(50, "50文字以内で入力してください"),
});

type FormValues = z.infer<typeof schema>;

const inputBase =
  "w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export default function HomeSettingsPage() {
  const navigate = useNavigate();
  const home = useAuthStore((s) => s.home);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(home?.homeImagePath ?? null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const updateHome = useUpdateHome();
  const invitationQuery = useInvitationCode();
  const refreshCode = useRefreshInvitationCode();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: home?.name ?? "" },
  });

  const onSubmitName = async (values: FormValues) => {
    if (!home) return;
    try {
      await updateHome.mutateAsync({
        homeId: home.id,
        name: values.name.trim(),
        image: selectedFile,
      });
      setSelectedFile(null);
      toast.success("ホーム情報を更新しました");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleCopyCode = async () => {
    if (!invitationQuery.data?.code) return;
    await navigator.clipboard.writeText(invitationQuery.data.code);
    toast.success("招待コードをコピーしました");
  };

  const handleRefreshCode = () => {
    refreshCode();
    toast.info("招待コードを更新しています...");
  };

  if (!home) return null;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/home")}
          className="text-sm text-primary hover:underline"
          aria-label="ホームに戻る"
        >
          ‹ 戻る
        </button>
        <h1 className="text-xl font-semibold">ホーム設定</h1>
      </div>

      {/* Home image + name form */}
      <form onSubmit={handleSubmit(onSubmitName)} className="space-y-5">
        {/* Image */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative group"
            aria-label="ホーム画像を変更"
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="ホーム画像"
                className="h-20 w-20 rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground">
                {home.name.charAt(0)}
              </div>
            )}
            <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary text-xs text-white">
              ✏
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden
          />
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="home-name" className="text-sm font-medium">
            ホーム名
          </label>
          <div className="flex gap-2">
            <input
              id="home-name"
              type="text"
              aria-describedby={errors.name ? "home-name-error" : undefined}
              aria-invalid={!!errors.name}
              className={`${inputBase} flex-1 ${errors.name ? "border-destructive" : "border-input"}`}
              {...register("name")}
            />
            <button
              type="submit"
              disabled={updateHome.isPending || (!isDirty && !selectedFile)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updateHome.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                "保存"
              )}
            </button>
          </div>
          {errors.name && (
            <span id="home-name-error" role="alert" className="flex items-center gap-1 text-xs text-destructive">
              <span aria-hidden>⚠</span>
              {errors.name.message}
            </span>
          )}
        </div>
      </form>

      {/* Invitation code */}
      <section aria-labelledby="invite-heading">
        <h2
          id="invite-heading"
          className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          招待コード
        </h2>
        <div className="rounded-xl border border-primary/30 bg-secondary/40 p-4 space-y-3">
          {invitationQuery.isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="招待コード取得中" />
            </div>
          ) : invitationQuery.data ? (
            <>
              <p
                className="text-center font-mono text-2xl font-bold tracking-widest text-foreground"
                aria-label={`招待コード: ${invitationQuery.data.code}`}
              >
                {invitationQuery.data.code}
              </p>
              <p className="text-center text-xs text-muted-foreground">
                有効期限:{" "}
                {format(new Date(invitationQuery.data.expires_at), "yyyy年M月d日", {
                  locale: ja,
                })}
              </p>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/50"
                >
                  📋 コピー
                </button>
                <button
                  type="button"
                  onClick={handleRefreshCode}
                  disabled={invitationQuery.isFetching}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/50 disabled:opacity-50"
                >
                  {invitationQuery.isFetching ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  ) : (
                    "🔄 再生成"
                  )}
                </button>
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-2">
              招待コードの取得に失敗しました
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

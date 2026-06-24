import { useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Cropper, { type ReactCropperElement } from "react-cropper";
import { ArrowLeft, Loader2, Pencil, X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useAuthStore } from "@/store/authStore";
import { useChangePassword, useUpdateProfile } from "../hooks/useSettings";

/* ── Cropper Modal ────────────────────────────────────────────────── */

interface CropperModalProps {
  imgSrc: string;
  onClose: () => void;
  onCrop: (file: File) => void;
}

function CropperModal({ imgSrc, onClose, onCrop }: CropperModalProps) {
  const cropperRef = useRef<ReactCropperElement>(null);
  const [isCropping, setIsCropping] = useState(false);

  const handleZoom = (ratio: number) => {
    cropperRef.current?.cropper.zoom(ratio);
  };

  const handleRotate = () => {
    cropperRef.current?.cropper.rotate(90);
  };

  const handleConfirm = useCallback(() => {
    const canvas = cropperRef.current?.cropper.getCroppedCanvas({
      width: 300,
      height: 300,
    });
    if (!canvas) return;
    setIsCropping(true);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], "icon.jpg", { type: "image/jpeg" });
          onCrop(file);
        }
        setIsCropping(false);
      },
      "image/jpeg",
      0.85,
    );
  }, [onCrop]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="画像をトリミング"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-2xl">
        {/* Title */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold">画像をトリミング</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cropper area */}
        <div className="bg-zinc-900" style={{ height: 260 }}>
          <Cropper
            ref={cropperRef}
            src={imgSrc}
            style={{ height: "100%", width: "100%" }}
            aspectRatio={1}
            viewMode={1}
            guides={false}
            cropBoxMovable={false}
            cropBoxResizable={false}
            dragMode="move"
            center
            background={false}
            responsive
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 border-b border-border px-4 py-2">
          <button
            type="button"
            onClick={() => handleZoom(-0.1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="縮小"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(0.1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="拡大"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleRotate}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="90度回転"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <p className="ml-1 text-xs text-muted-foreground">ドラッグで位置調整</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isCropping}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isCropping && <Loader2 className="h-4 w-4 animate-spin" />}
            この画像を使う
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── ProfileSettingsPage ──────────────────────────────────────────── */

export default function ProfileSettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user?.icon_url ?? null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const hasChanges =
    nickname.trim() !== (user?.nickname ?? "") || croppedFile !== null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCropperSrc(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCrop = (file: File) => {
    setCroppedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setCropperSrc(null);
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("新しいパスワードが一致しません");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("パスワードは8文字以上で入力してください");
      return;
    }
    try {
      await changePassword.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("パスワードを変更しました");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleSubmit = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      toast.error("ニックネームを入力してください");
      return;
    }
    try {
      await updateProfile.mutateAsync({
        nickname: trimmed,
        icon: croppedFile ?? undefined,
      });
      toast.success("プロフィールを更新しました");
      setCroppedFile(null);
      navigate(-1);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (!user) return null;

  return (
    <>
      <div className="mx-auto max-w-xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            aria-label="戻る"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-xl font-semibold">プロフィール設定</h1>
        </div>

        {/* Avatar upload */}
        <div className="mb-5 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
            aria-label="プロフィール画像を変更"
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="プロフィール画像"
                className="h-20 w-20 rounded-full object-cover shadow-md"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground shadow-md">
                {user.nickname.charAt(0)}
              </div>
            )}
            <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary text-white shadow-sm">
              <Pencil className="h-3.5 w-3.5" />
            </span>
          </button>
          <p className="text-xs text-muted-foreground">タップして画像を変更</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />
        </div>

        {/* Nickname */}
        <div className="mb-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              ニックネーム
            </p>
          </div>
          <div className="p-4">
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={50}
              placeholder="ニックネームを入力"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="ニックネーム"
            />
          </div>
        </div>

        {/* Email (read-only) */}
        <div className="mb-6 rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              メールアドレス（変更不可）
            </p>
          </div>
          <div className="p-4">
            <input
              type="email"
              value={user.email}
              disabled
              readOnly
              className="w-full cursor-not-allowed rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground outline-none"
              aria-label="メールアドレス（変更不可）"
            />
          </div>
        </div>

        {/* Save */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={updateProfile.isPending || !hasChanges}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          保存する
        </button>

        {/* Password change */}
        <div className="mt-6 rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              パスワード変更
            </p>
          </div>
          <div className="space-y-3 p-4">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="現在のパスワード"
              autoComplete="current-password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="現在のパスワード"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新しいパスワード（8文字以上）"
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="新しいパスワード"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="新しいパスワード（確認）"
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="新しいパスワード（確認）"
            />
            <button
              type="button"
              onClick={handlePasswordChange}
              disabled={
                changePassword.isPending ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {changePassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              パスワードを変更する
            </button>
          </div>
        </div>
      </div>

      {/* Cropper modal */}
      {cropperSrc && (
        <CropperModal
          imgSrc={cropperSrc}
          onClose={() => setCropperSrc(null)}
          onCrop={handleCrop}
        />
      )}
    </>
  );
}

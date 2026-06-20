import { useState } from "react";
import { cn } from "@/lib/utils";

const COLORS = [
  "bg-teal-500",
  "bg-amber-600",
  "bg-blue-600",
  "bg-rose-600",
  "bg-violet-600",
  "bg-emerald-600",
];

interface UserAvatarProps {
  nickname: string;
  iconUrl: string | null;
  userId?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function UserAvatar({ nickname, iconUrl, userId = 0, size = "md", className }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const color = COLORS[userId % COLORS.length];
  const sizeClass = size === "sm" ? "h-6 w-6 text-[9px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";

  if (iconUrl && !imgError) {
    return (
      <img
        src={iconUrl}
        alt={nickname}
        className={cn("rounded-full object-cover shrink-0", sizeClass, className)}
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold text-white shrink-0",
        sizeClass,
        color,
        className,
      )}
    >
      {nickname.charAt(0)}
    </span>
  );
}

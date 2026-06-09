import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { ImageIcon, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useAuthStore } from "@/store/authStore";
import { useChatHistory, useUploadChatImage } from "../hooks/useChat";
import { useChatSocket } from "../hooks/useChatSocket";
import type { ChatMessage } from "../types";

/* ── Helpers ───────────────────────────────────────────────────── */

function formatTimestamp(ts: string): string {
  return format(parseISO(ts), "HH:mm");
}

function formatDateSeparator(ts: string): string {
  const date = parseISO(ts);
  if (isToday(date)) return "今日";
  if (isYesterday(date)) return "昨日";
  return format(date, "M月d日（E）", { locale: ja });
}

function getDayKey(ts: string): string {
  return format(parseISO(ts), "yyyy-MM-dd");
}

/* ── Sub-components ────────────────────────────────────────────── */

function Avatar({
  iconUrl,
  nickname,
}: {
  iconUrl: string | null;
  nickname: string;
}) {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={nickname}
        className="h-7 w-7 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
      {nickname.charAt(0)}
    </span>
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-2">
      <div className="flex-1 border-t border-border" />
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}

function MessageBubble({
  msg,
  isOwn,
}: {
  msg: ChatMessage;
  isOwn: boolean;
}) {
  return (
    <div className={cn("flex items-end gap-2", isOwn ? "flex-row-reverse" : "")}>
      {!isOwn && <Avatar iconUrl={msg.icon_url} nickname={msg.nickname} />}

      <div className={cn("flex max-w-[72%] flex-col gap-0.5", isOwn ? "items-end" : "items-start")}>
        {!isOwn && (
          <span className="px-1 text-[11px] font-medium text-muted-foreground">
            {msg.nickname}
          </span>
        )}

        {msg.type === "image" && msg.image_url ? (
          <img
            src={msg.image_url}
            alt="画像メッセージ"
            className="max-w-[200px] rounded-2xl object-cover"
          />
        ) : (
          <div
            className={cn(
              "rounded-2xl px-3 py-2 text-sm leading-relaxed",
              isOwn
                ? "rounded-br-sm bg-primary text-primary-foreground"
                : "rounded-bl-sm border border-border bg-card text-foreground",
            )}
          >
            {msg.message}
          </div>
        )}

        <span className="px-1 text-[10px] text-muted-foreground">
          {formatTimestamp(msg.timestamp)}
        </span>
      </div>
    </div>
  );
}

/* ── Connection status banner ──────────────────────────────────── */

function StatusBanner({ isConnected }: { isConnected: boolean }) {
  if (isConnected) return null;
  return (
    <div className="flex-shrink-0 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
      接続が切断されました。再接続中…
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────── */

export default function ChatPage() {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [inputText, setInputText] = useState("");
  const [wsMessages, setWsMessages] = useState<ChatMessage[]>([]);

  /* Scroll position preservation when prepending history */
  const prevScrollHeightRef = useRef<number | null>(null);

  /* ── REST history ───────────────────────────────────────── */
  const {
    data: historyData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: historyLoading,
  } = useChatHistory();

  const historyMessages = useMemo(
    () => (historyData?.pages.slice().reverse().flat() ?? []) as ChatMessage[],
    [historyData],
  );

  /* ── WebSocket ──────────────────────────────────────────── */
  const handleWsMessage = useCallback((msg: ChatMessage) => {
    setWsMessages((prev) => [...prev, msg]);
  }, []);

  const { sendMessage, sendImage, sendRead, isConnected } = useChatSocket(handleWsMessage);

  /* ── Image upload ───────────────────────────────────────── */
  const uploadImage = useUploadChatImage();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const { image_path } = await uploadImage.mutateAsync(file);
      sendImage(image_path);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  /* ── Merged message list ────────────────────────────────── */
  const historyIds = useMemo(
    () => new Set(historyMessages.map((m) => m.id)),
    [historyMessages],
  );
  const filteredWsMessages = useMemo(
    () => wsMessages.filter((m) => !historyIds.has(m.id)),
    [wsMessages, historyIds],
  );
  const allMessages = useMemo(
    () => [...historyMessages, ...filteredWsMessages],
    [historyMessages, filteredWsMessages],
  );

  /* Date separator list */
  const renderedItems = useMemo(() => {
    type Item =
      | { kind: "sep"; label: string; key: string }
      | { kind: "msg"; msg: ChatMessage };
    const items: Item[] = [];
    let lastDay = "";
    for (const msg of allMessages) {
      const day = getDayKey(msg.timestamp);
      if (day !== lastDay) {
        items.push({ kind: "sep", label: formatDateSeparator(msg.timestamp), key: day });
        lastDay = day;
      }
      items.push({ kind: "msg", msg });
    }
    return items;
  }, [allMessages]);

  /* ── Scroll to bottom on new WS messages ───────────────── */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (filteredWsMessages.length > 0) scrollToBottom();
  }, [filteredWsMessages.length, scrollToBottom]);

  /* Scroll to bottom after initial history load */
  useEffect(() => {
    if (historyData?.pages.length === 1 && !historyLoading) {
      messagesEndRef.current?.scrollIntoView();
    }
  }, [historyData?.pages.length, historyLoading]);

  /* Restore scroll position after prepending more history */
  const pageCount = historyData?.pages.length ?? 0;
  useEffect(() => {
    if (prevScrollHeightRef.current !== null && containerRef.current) {
      const delta = containerRef.current.scrollHeight - prevScrollHeightRef.current;
      containerRef.current.scrollTop = delta;
      prevScrollHeightRef.current = null;
    }
  }, [pageCount]);

  /* Send read receipt when page is focused */
  useEffect(() => {
    if (isConnected) sendRead();
  }, [isConnected, sendRead]);

  /* ── Handlers ───────────────────────────────────────────── */
  const handleLoadMore = () => {
    if (containerRef.current) {
      prevScrollHeightRef.current = containerRef.current.scrollHeight;
    }
    fetchNextPage();
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !isConnected) return;
    sendMessage(text);
    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-base font-semibold">チャット</h1>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isConnected ? "bg-green-500" : "bg-amber-400",
              )}
              aria-hidden
            />
            {isConnected ? "接続中" : "再接続中…"}
          </span>
        </div>
      </div>

      {/* Reconnecting banner */}
      <StatusBanner isConnected={isConnected} />

      {/* Message list */}
      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-y-auto bg-secondary/20 px-4 py-3"
      >
        <div className="mx-auto max-w-3xl space-y-3">
          {/* Load more history */}
          {hasNextPage && (
            <div className="flex justify-center pb-1">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isFetchingNextPage}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-primary hover:bg-secondary/40 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    読み込み中…
                  </>
                ) : (
                  "↑ 過去のメッセージを読み込む"
                )}
              </button>
            </div>
          )}

          {historyLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="読み込み中" />
            </div>
          )}

          {/* Messages */}
          {renderedItems.map((item) =>
            item.kind === "sep" ? (
              <DateSeparator key={item.key} label={item.label} />
            ) : (
              <MessageBubble
                key={item.msg.id}
                msg={item.msg}
                isOwn={item.msg.user_id === currentUserId}
              />
            ),
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Upload preview */}
      {uploadImage.isPending && (
        <div className="flex-shrink-0 border-t border-border bg-card px-4 py-2">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">画像をアップロード中…</p>
            </div>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-border bg-card px-3 py-2.5">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          {/* Image attach */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isConnected || uploadImage.isPending}
            aria-label="画像を送信"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ImageIcon className="h-4.5 w-4.5" />
          </button>

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? "メッセージを入力… (Enter で送信)" : "接続を待っています…"}
            disabled={!isConnected}
            rows={1}
            className="flex-1 resize-none overflow-hidden rounded-2xl border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all disabled:cursor-not-allowed disabled:opacity-60"
            style={{ maxHeight: 120 }}
            aria-label="メッセージ入力欄"
          />

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim() || !isConnected}
            aria-label="メッセージを送信"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden
      />
    </div>
  );
}

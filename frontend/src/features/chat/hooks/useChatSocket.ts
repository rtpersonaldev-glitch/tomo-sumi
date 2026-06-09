import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import type { ChatMessage } from "../types";

interface UseChatSocketReturn {
  sendMessage: (text: string) => void;
  sendImage: (imagePath: string) => void;
  sendRead: () => void;
  isConnected: boolean;
}

export const useChatSocket = (
  onMessage: (msg: ChatMessage) => void,
): UseChatSocketReturn => {
  const homeId = useAuthStore((s) => s.home?.id);
  const navigate = useNavigate();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Keep onMessage stable across renders without re-creating the socket */
  const onMessageRef = useRef(onMessage);
  useLayoutEffect(() => {
    onMessageRef.current = onMessage;
  });

  useEffect(() => {
    if (!homeId) return;

    const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL as string | undefined;
    const wsUrl = wsBaseUrl
      ? `${wsBaseUrl}/api/chat/ws/${homeId}`
      : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/chat/ws/${homeId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as ChatMessage;
        onMessageRef.current(data);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = (event: CloseEvent) => {
      setIsConnected(false);
      wsRef.current = null;
      if (event.code === 4001) {
        navigate("/login", { replace: true });
      } else if (event.code === 4003) {
        navigate("/home-select", { replace: true });
      } else if (event.code !== 1000) {
        /* Unexpected disconnect — retry after 3 seconds */
        reconnectTimerRef.current = setTimeout(() => {
          setReconnectAttempt((n) => n + 1);
        }, 3000);
      }
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      ws.close(1000);
      wsRef.current = null;
    };
  }, [homeId, reconnectAttempt, navigate]);

  const sendMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", message: text }));
    }
  }, []);

  const sendImage = useCallback((imagePath: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "image", image_path: imagePath }));
    }
  }, []);

  const sendRead = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "read" }));
    }
  }, []);

  return { sendMessage, sendImage, sendRead, isConnected };
};

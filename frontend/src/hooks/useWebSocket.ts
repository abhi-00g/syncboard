import { useEffect, useRef, useCallback, useState } from "react";
import type { WSEvent } from "../types";

interface UseWebSocketOptions {
  boardId: number;
  token: string | null;
  onEvent: (event: WSEvent) => void;
  enabled?: boolean;
}

export function useWebSocket({
  boardId,
  token,
  onEvent,
  enabled = true,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const mountedRef = useRef(true);
  const [isConnected, setIsConnected] = useState(false);

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const cleanup = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!token || !enabled || !mountedRef.current) return;

    cleanup();

    // Close existing connection without triggering reconnect
    if (wsRef.current) {
      wsRef.current.onclose = null; // Remove handler so close doesn't trigger reconnect
      wsRef.current.close();
      wsRef.current = null;
    }

    const wsBase = import.meta.env.VITE_WS_URL;
    const url = wsBase
      ? `${wsBase}/ws/boards/${boardId}?token=${token}`
      : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/boards/${boardId}?token=${token}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      console.log(`[WS] Connected to board ${boardId}`);
      setIsConnected(true);
      reconnectAttempts.current = 0;

      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "heartbeat" }));
        }
      }, 15000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSEvent;
        if (data.type === "heartbeat_ack") return;
        onEventRef.current(data);
      } catch {
        console.warn("[WS] Failed to parse message:", event.data);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      cleanup();

      // Only reconnect if the component is still mounted
      if (mountedRef.current && enabled && reconnectAttempts.current < 10) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`);
        reconnectRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      }
    };
  }, [boardId, token, enabled, cleanup]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      cleanup();
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on unmount
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, cleanup]);

  return { isConnected };
}
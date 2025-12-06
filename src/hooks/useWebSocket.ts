import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectDelay?: number;
}

export function useWebSocket(projectId: string, options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
  const subscriptions = useRef<Set<string>>(new Set());
  const isConnecting = useRef(false);

  const connect = useCallback(() => {
    if (!projectId || isConnecting.current || (ws.current?.readyState === WebSocket.OPEN)) return;
    
    isConnecting.current = true;

    try {
      const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3001';
      const wsUrl = `${protocol}//${host}/api/ws?projectId=${projectId}`;

      console.log(`[WebSocket] Connecting to ${wsUrl}`);
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('[WebSocket] Connected');
        isConnecting.current = false;
        setIsConnected(true);
        options.onConnect?.();

        // Re-subscribe to channels after reconnect
        subscriptions.current.forEach(channel => {
          send({ type: 'subscribe', channel });
        });
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          setLastMessage(message);
          options.onMessage?.(message);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      ws.current.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setIsConnected(false);
        options.onDisconnect?.();

        // Auto-reconnect after delay
        const delay = options.reconnectDelay || 3000;
        reconnectTimeout.current = setTimeout(() => {
          console.log('[WebSocket] Reconnecting...');
          connect();
        }, delay);
      };

      ws.current.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        isConnecting.current = false;
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      isConnecting.current = false;
    }
  }, [projectId, options]);

  const send = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send message, connection not open');
    }
  }, []);

  const subscribe = useCallback((channel: string) => {
    subscriptions.current.add(channel);
    send({ type: 'subscribe', channel });
  }, [send]);

  const unsubscribe = useCallback((channel: string) => {
    subscriptions.current.delete(channel);
    send({ type: 'unsubscribe', channel });
  }, [send]);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    ws.current?.close();
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [projectId]); // Only reconnect when projectId changes, not on every render

  return {
    isConnected,
    lastMessage,
    send,
    subscribe,
    unsubscribe,
    reconnect: connect,
  };
}

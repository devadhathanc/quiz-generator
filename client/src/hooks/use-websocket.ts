import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

// Global WebSocket instance
let globalWs: WebSocket | null = null;
let globalListeners: Set<(message: WebSocketMessage) => void> = new Set();
let globalConnectCallbacks: Set<() => void> = new Set();
let globalDisconnectCallbacks: Set<() => void> = new Set();
let globalErrorCallbacks: Set<(error: Event) => void> = new Set();

function getGlobalWebSocket(): WebSocket | null {
  if (!globalWs || globalWs.readyState === WebSocket.CLOSED) {
    return null;
  }
  return globalWs;
}

function createGlobalWebSocket(): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  let host = window.location.host;
  
  // Handle cases where port is undefined
  if (!host || host.includes('undefined')) {
    const hostname = window.location.hostname || 'localhost';
    const port = window.location.port || '5001';
    host = `${hostname}:${port}`;
  }
  
  const wsUrl = `${protocol}//${host}/ws`;
  
  try {
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      globalConnectCallbacks.forEach(callback => callback());
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        globalListeners.forEach(listener => listener(message));
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = (event) => {
      globalWs = null;
      globalDisconnectCallbacks.forEach(callback => callback());
    };

    ws.onerror = (error) => {
      console.error('❌ Global WebSocket error:', error);
      globalErrorCallbacks.forEach(callback => callback(error));
    };
    
    return ws;
  } catch (error) {
    console.error('❌ Failed to create WebSocket:', error);
    throw error;
  }
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { onMessage, onConnect, onDisconnect, onError } = options;

  const connect = useCallback(() => {
    const existingWs = getGlobalWebSocket();
    if (existingWs) {
      setIsConnected(true);
      setConnectionError(null);
      onConnect?.();
      return;
    }

    try {
      globalWs = createGlobalWebSocket();
      setIsConnected(true);
      setConnectionError(null);
      onConnect?.();
    } catch (error) {
      console.error('❌ Failed to create global WebSocket connection:', error);
      setConnectionError('Failed to create WebSocket connection');
      setIsConnected(false);
      onError?.(error as Event);
    }
  }, [onConnect, onError]);

  const disconnect = useCallback(() => {
    if (globalWs) {
      globalWs.close();
      globalWs = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    const ws = getGlobalWebSocket();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn('❌ Global WebSocket is not connected, cannot send message:', message);
    }
  }, []);

  // Register listeners
  useEffect(() => {
    if (onMessage) {
      globalListeners.add(onMessage);
    }
    if (onConnect) {
      globalConnectCallbacks.add(onConnect);
    }
    if (onDisconnect) {
      globalDisconnectCallbacks.add(onDisconnect);
    }
    if (onError) {
      globalErrorCallbacks.add(onError);
    }

    // Check if we're already connected
    const existingWs = getGlobalWebSocket();
    if (existingWs) {
      setIsConnected(true);
      setConnectionError(null);
    }

    return () => {
      // Remove listeners but don't disconnect the global WebSocket
      if (onMessage) {
        globalListeners.delete(onMessage);
      }
      if (onConnect) {
        globalConnectCallbacks.delete(onConnect);
      }
      if (onDisconnect) {
        globalDisconnectCallbacks.delete(onDisconnect);
      }
      if (onError) {
        globalErrorCallbacks.delete(onError);
      }
    };
  }, [onMessage, onConnect, onDisconnect, onError]);

  return {
    isConnected,
    connectionError,
    connect,
    disconnect,
    sendMessage,
  };
}

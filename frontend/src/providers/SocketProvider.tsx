import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useNotification } from '../hooks/useNotification';
import { SocketContext } from '../hooks/useSocket';

const SOCKET_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';
const MAX_RECONNECT_ATTEMPTS = 5;

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [isPollingFallback, setIsPollingFallback] = useState(false);
  const { notifySuccess, notifyError } = useNotification();

  // Track whether the first successful connection has fired so we don't
  // show the "connected" toast on every reconnect after a brief drop.
  const hasConnectedOnce = useRef(false);
  const reconnectCount = useRef(0);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      withCredentials: true,
      // Try WebSocket first; fall back to HTTP long-polling automatically.
      transports: ['websocket', 'polling'],
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
      reconnectCount.current = 0;

      if (!hasConnectedOnce.current) {
        hasConnectedOnce.current = true;
        notifySuccess('Real-time updates active');
      } else {
        // Silently restore; only inform if we were in fallback mode.
        if (isPollingFallback) {
          setIsPollingFallback(false);
          notifySuccess('Real-time updates restored');
        }
      }
    });

    newSocket.on('disconnect', (reason: string) => {
      setConnected(false);
      // Transport-close is a deliberate server close; other reasons are
      // unexpected and warrant user notification.
      if (reason !== 'io client disconnect') {
        notifyError('Real-time connection lost', 'Attempting to reconnect…');
      }
    });

    newSocket.on('reconnect_attempt', (attempt: number) => {
      reconnectCount.current = attempt;
    });

    newSocket.on('reconnect_failed', () => {
      // All reconnect attempts exhausted — switch to polling fallback so
      // components can activate their own HTTP polling intervals.
      setIsPollingFallback(true);
      notifyError(
        'Real-time updates unavailable',
        'Switched to polling fallback. Data may refresh less frequently.'
      );
    });

    newSocket.on('connect_error', () => {
      setConnected(false);
    });

    return () => {
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Subscription helpers ───────────────────────────────────────────────

  const subscribeToTransaction = (transactionId: string) => {
    if (socket && connected) {
      socket.emit('subscribe:transaction', transactionId);
    }
  };

  const unsubscribeFromTransaction = (transactionId: string) => {
    if (socket && connected) {
      socket.emit('unsubscribe:transaction', transactionId);
    }
  };

  const subscribeToBulk = (batchId: string) => {
    if (socket && connected) {
      socket.emit('subscribe:bulk', { batchId });
    }
  };

  const unsubscribeFromBulk = (batchId: string) => {
    if (socket && connected) {
      socket.emit('unsubscribe:bulk', { batchId });
    }
  };

  return (
    <SocketContext
      value={{
        socket,
        connected,
        isPollingFallback,
        subscribeToTransaction,
        unsubscribeFromTransaction,
        subscribeToBulk,
        unsubscribeFromBulk,
      }}
    >
      {children}
    </SocketContext>
  );
};

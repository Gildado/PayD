import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useNotification } from '../hooks/useNotification';
import { SocketContext } from '../hooks/useSocket';
import { useNetwork } from '../hooks/useNetwork';

// Assuming backend is running on port 3000
const SOCKET_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const { notifySuccess, notifyError } = useNotification();
  const { network } = useNetwork();

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'], // Allow fallback to polling
      reconnectionAttempts: 5,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setConnected(true);
      notifySuccess('Real-time updates connected');
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
      notifyError('Real-time updates disconnected');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setConnected(false);
    });

    return () => {
      newSocket.disconnect();
    };
    // Re-connect with a clean socket on network change to clear all subscriptions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifySuccess, notifyError, network]);

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

  return (
    <SocketContext
      value={{
        socket,
        connected,
        subscribeToTransaction,
        unsubscribeFromTransaction,
      }}
    >
      {children}
    </SocketContext>
  );
};

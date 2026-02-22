import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useNotification } from './NotificationProvider';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  subscribeToTransaction: (transactionId: string) => void;
  unsubscribeFromTransaction: (transactionId: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Assuming backend is running on port 3000
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const { notify } = useNotification();

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
      notify('Real-time updates connected');
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
      notify('Real-time updates disconnected');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setConnected(false);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

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
    <SocketContext.Provider
      value={{
        socket,
        connected,
        subscribeToTransaction,
        unsubscribeFromTransaction,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

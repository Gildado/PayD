import { createContext, use } from 'react';
import { Socket } from 'socket.io-client';

export interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  /** True when the WebSocket transport has failed and the app is using HTTP polling as a fallback */
  isPollingFallback: boolean;
  subscribeToTransaction: (transactionId: string) => void;
  unsubscribeFromTransaction: (transactionId: string) => void;
  subscribeToBulk: (batchId: string) => void;
  unsubscribeFromBulk: (batchId: string) => void;
}

export const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = use(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

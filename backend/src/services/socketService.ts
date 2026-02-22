import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { config } from '../config/env';

let io: SocketIOServer | null = null;

export const initializeSocket = (httpServer: HttpServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });

    // Handle subscription to specific transaction updates
    socket.on('subscribe:transaction', (transactionId: string) => {
      console.log(`Client ${socket.id} subscribed to transaction ${transactionId}`);
      socket.join(`transaction:${transactionId}`);
    });

    socket.on('unsubscribe:transaction', (transactionId: string) => {
      console.log(`Client ${socket.id} unsubscribed from transaction ${transactionId}`);
      socket.leave(`transaction:${transactionId}`);
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

// Helper to emit transaction updates
export const emitTransactionUpdate = (transactionId: string, status: string, data?: any) => {
  try {
    const ioInstance = getIO();
    ioInstance.to(`transaction:${transactionId}`).emit('transaction:update', {
      transactionId,
      status,
      timestamp: new Date().toISOString(),
      ...data,
    });
  } catch (error) {
    console.warn('Failed to emit transaction update (Socket.IO might not be initialized yet)');
  }
};

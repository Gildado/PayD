import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { config } from '../config/env.js';

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

    // Handle subscription to bulk payroll batch updates
    socket.on('subscribe:bulk', ({ batchId }: { batchId: string }) => {
      console.log(`Client ${socket.id} subscribed to bulk batch ${batchId}`);
      socket.join(`bulk:${batchId}`);
    });

    socket.on('unsubscribe:bulk', ({ batchId }: { batchId: string }) => {
      console.log(`Client ${socket.id} unsubscribed from bulk batch ${batchId}`);
      socket.leave(`bulk:${batchId}`);
    });

    // Handle subscription to wallet balance updates
    socket.on('subscribe:balance', (walletAddress: string) => {
      console.log(`Client ${socket.id} subscribed to balance updates for ${walletAddress}`);
      socket.join(`balance:${walletAddress}`);
    });

    socket.on('unsubscribe:balance', (walletAddress: string) => {
      console.log(`Client ${socket.id} unsubscribed from balance updates for ${walletAddress}`);
      socket.leave(`balance:${walletAddress}`);
    });
  });

  return io;
};

// Helper to emit bulk payroll updates
export const emitBulkUpdate = (batchId: string, status: string, data?: any) => {
  try {
    const ioInstance = getIO();
    ioInstance.to(`bulk:${batchId}`).emit('bulk:confirmation', {
      batchId,
      status,
      timestamp: new Date().toISOString(),
      ...data,
    });
  } catch (error) {
    console.warn('Failed to emit bulk update (Socket.IO might not be initialized yet)');
  }
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

// Helper to emit balance updates to subscribers of a specific wallet address
export const emitBalanceUpdate = (walletAddress: string, data?: any) => {
  try {
    const ioInstance = getIO();
    ioInstance.to(`balance:${walletAddress}`).emit('balance:update', {
      walletAddress,
      timestamp: new Date().toISOString(),
      ...data,
    });
  } catch (error) {
    console.warn('Failed to emit balance update (Socket.IO might not be initialized yet)');
  }
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

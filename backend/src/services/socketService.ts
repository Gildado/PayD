import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { config } from '../config/env.js';
import logger from '../utils/logger.js';

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
    logger.info('Socket client connected', { socketId: socket.id });

    socket.on('disconnect', () => {
      logger.info('Socket client disconnected', { socketId: socket.id });
    });

    // Handle subscription to specific transaction updates
    socket.on('subscribe:transaction', (transactionId: string) => {
      logger.info('Socket client subscribed to transaction', { socketId: socket.id, transactionId });
      socket.join(`transaction:${transactionId}`);
    });

    socket.on('unsubscribe:transaction', (transactionId: string) => {
      logger.info('Socket client unsubscribed from transaction', { socketId: socket.id, transactionId });
      socket.leave(`transaction:${transactionId}`);
    });

    // Handle subscription to bulk payroll batch updates
    socket.on('subscribe:bulk', ({ batchId }: { batchId: string }) => {
      logger.info('Socket client subscribed to bulk batch', { socketId: socket.id, batchId });
      socket.join(`bulk:${batchId}`);
    });

    socket.on('unsubscribe:bulk', ({ batchId }: { batchId: string }) => {
      logger.info('Socket client unsubscribed from bulk batch', { socketId: socket.id, batchId });
      socket.leave(`bulk:${batchId}`);
    });

    // Handle subscription to wallet balance updates
    socket.on('subscribe:balance', (walletAddress: string) => {
      logger.info('Socket client subscribed to balance updates', { socketId: socket.id, walletAddress });
      socket.join(`balance:${walletAddress}`);
    });

    socket.on('unsubscribe:balance', (walletAddress: string) => {
      logger.info('Socket client unsubscribed from balance updates', { socketId: socket.id, walletAddress });
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
    logger.warn('Failed to emit bulk update', { batchId, error });
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
    logger.warn('Failed to emit balance update', { walletAddress, error });
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
    logger.warn('Failed to emit transaction update', { transactionId, error });
  }
};

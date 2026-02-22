import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config/env';
import searchRoutes from './routes/searchRoutes';
import employeeRoutes from './routes/employeeRoutes';
import paymentRoutes from './routes/paymentRoutes';
import authRoutes from './routes/authRoutes';
import assetRoutes from './routes/assetRoutes';
import { initializeSocket, emitTransactionUpdate } from './services/socketService';
import { HealthController } from './controllers/healthController';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
initializeSocket(httpServer);

// Middleware
app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/assets', assetRoutes);

// Transaction simulation endpoint (for testing WebSocket updates)
app.post('/api/simulate-transaction-update', (req, res) => {
  const { transactionId, status, data } = req.body;
  
  if (!transactionId || !status) {
    return res.status(400).json({ error: 'Missing transactionId or status' });
  }

  emitTransactionUpdate(transactionId, status, data);
  
  return res.json({ 
    success: true, 
    message: `Update emitted for transaction ${transactionId}` 
  });
});

// Health check
app.get('/health', HealthController.getHealthStatus);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const PORT = config.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
});

export default app;

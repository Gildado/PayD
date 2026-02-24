import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config/env';
import { getThrottlingConfig } from './config/env';
import { apiVersionMiddleware } from './middlewares/apiVersionMiddleware';
import v1Routes from './routes/v1';
import { initializeSocket, emitTransactionUpdate } from './services/socketService';
import { HealthController } from './controllers/healthController';
import { ThrottlingService } from './services/throttlingService';

const app = express();
const httpServer = createServer(app);

initializeSocket(httpServer);

ThrottlingService.getInstance(getThrottlingConfig());

app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(apiVersionMiddleware);

app.use('/api/v1', v1Routes);

app.use('/api/auth', v1Routes);
app.use('/api/search', v1Routes);
app.use('/api/employees', v1Routes);
app.use('/api/payments', v1Routes);
app.use('/api/assets', v1Routes);
app.use('/api/throttling', v1Routes);
app.use('/api/payroll-bonus', v1Routes);
app.use('/api/payroll/audit', v1Routes);
app.use('/api/payroll', v1Routes);
app.use('/api/audit', v1Routes);
app.use('/api/balance', v1Routes);
app.use('/api/trustline', v1Routes);
app.use('/api/taxes', v1Routes);

app.post('/api/v1/simulate-transaction-update', (req, res) => {
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

app.get('/health', HealthController.getHealthStatus);

app.get('/api', (req, res) => {
  res.json({
    name: 'PayD API',
    currentVersion: 'v1',
    supportedVersions: ['v1'],
    endpoints: {
      v1: '/api/v1',
    },
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

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

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import config from './config';
import logger from './utils/logger';
import payrollRoutes from './routes/payroll.routes';
import authRoutes from './routes/authRoutes';
import employeeRoutes from './routes/employeeRoutes';
import assetRoutes from './routes/assetRoutes';
import paymentRoutes from './routes/paymentRoutes';
import searchRoutes from './routes/searchRoutes';

const app = express();

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/search', searchRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : 'An error occurred',
  });
});

export default app;

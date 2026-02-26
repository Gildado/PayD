import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import passport from './config/passport.js';
import authRoutes from './routes/authRoutes.js';
import { apiRateLimit } from './middlewares/rateLimitMiddleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === 'production';
const corsWhitelist = (process.env.CORS_WHITELIST || process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsMiddleware = cors({
  origin(origin, callback) {
    if (!isProduction) {
      callback(null, true);
      return;
    }

    // Allow non-browser clients (no Origin header) in controlled server usage.
    if (!origin) {
      callback(null, true);
      return;
    }

    if (corsWhitelist.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
});

app.use(
  helmet({
    contentSecurityPolicy: isProduction ? undefined : false,
    crossOriginEmbedderPolicy: isProduction,
  })
);
app.use(corsMiddleware);
app.use(apiRateLimit());
app.use(express.json());
app.use(passport.initialize());

// Routes
app.use('/auth', authRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

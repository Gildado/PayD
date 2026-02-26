import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import passport from './config/passport.js';
import authRoutes from './routes/authRoutes.js';
import contractEventRoutes from './routes/contractEventRoutes.js';
import { ContractEventIndexerService } from './services/contractEventIndexerService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

// Routes
app.use('/auth', authRoutes);
app.use('/api/events', contractEventRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  const shouldRunIndexer = process.env.ENABLE_CONTRACT_EVENT_INDEXER !== 'false';
  if (shouldRunIndexer) {
    void (async () => {
      await ContractEventIndexerService.initialize();
      ContractEventIndexerService.start();
      console.log('Contract event indexer started');
    })();
  }
});

process.on('SIGTERM', () => {
  ContractEventIndexerService.stop();
});

process.on('SIGINT', () => {
  ContractEventIndexerService.stop();
});

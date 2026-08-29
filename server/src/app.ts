import cors from 'cors';
import express, { type Express } from 'express';
import { boardRouter } from './routes/board.js';
import { devinCallbackRouter } from './routes/devinCallback.js';
import { webhookRouter } from './routes/webhooks.js';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  // Webhooks need the raw body for signature verification, so they are mounted first.
  app.use('/api/webhooks', webhookRouter);
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/devin', devinCallbackRouter);
  app.use('/api', boardRouter);

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

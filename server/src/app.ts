import path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import { config } from './config.js';
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

  // The container ships the built frontend alongside the API so both share one origin and one port.
  if (config.SERVE_WEB) {
    app.use(express.static(config.WEB_DIST));
    app.get(/^(?!\/api|\/healthz).*/, (_req, res) => {
      res.sendFile(path.join(config.WEB_DIST, 'index.html'));
    });
  }

  return app;
}

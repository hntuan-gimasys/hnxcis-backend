/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import cors, { type CorsOptions } from 'cors';
import express, { type Express } from 'express';
import { env } from './config/env.ts';
import { attachUser } from './middleware/auth.ts';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.ts';
import { apiRouter } from './routes/index.ts';

function buildCorsOptions(): CorsOptions {
  // No allowlist configured (local dev): reflect the caller's origin.
  if (env.corsOrigins.length === 0) {
    if (env.isProduction) {
      console.warn('[cors] CORS_ORIGINS is empty in production — all origins are allowed.');
    }
    return { origin: true, credentials: true };
  }

  return {
    origin(origin, callback) {
      // Same-origin / server-to-server calls send no Origin header.
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin không được phép bởi CORS: ${origin}`));
    },
    credentials: true,
  };
}

export function createApp(): Express {
  const app = express();

  // Cloud Run sits behind a proxy: trust it so req.ip / protocol are correct.
  app.set('trust proxy', true);
  app.disable('x-powered-by');

  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.use((req, _res, next) => {
    if (req.path !== '/api/health') {
      console.log(`[req] ${req.method} ${req.originalUrl}`);
    }
    next();
  });

  app.use(attachUser);
  app.use('/api', apiRouter);

  // Root: identify the service (this container serves the API only — the SPA is
  // a separate Cloud Run service).
  app.get('/', (_req, res) => {
    res.json({ service: 'hnxcis-backend', docs: '/api/health' });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

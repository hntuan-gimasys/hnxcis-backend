/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { env, isDatabaseConfigured } from '../config/env.ts';
import { pingDatabase } from '../db/index.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';

export const healthRouter = Router();

const SERVICE_NAME = 'HNX-CIS Corporate Information System API';

/** Liveness — must never touch external dependencies (Cloud Run startup probe). */
healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: SERVICE_NAME,
    env: env.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

/** Readiness — verifies the Cloud SQL connection. */
healthRouter.get(
  '/health/db',
  asyncHandler(async (_req, res) => {
    if (!isDatabaseConfigured) {
      return res.status(503).json({ status: 'unconfigured', database: null });
    }
    const { latencyMs } = await pingDatabase();
    res.json({
      status: 'ok',
      database: env.db.name,
      connection: env.db.instanceConnectionName
        ? `cloudsql:${env.db.instanceConnectionName}`
        : `tcp:${env.db.host}:${env.db.port}`,
      latencyMs,
    });
  }),
);

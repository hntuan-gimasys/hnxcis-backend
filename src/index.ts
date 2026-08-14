/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createApp } from './app.ts';
import { env } from './config/env.ts';
import { closePool } from './db/index.ts';

const app = createApp();

// Cloud Run requires listening on 0.0.0.0:$PORT.
const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`[HNX-CIS] API listening on http://0.0.0.0:${env.port} (${env.nodeEnv})`);
});

/** Cloud Run sends SIGTERM before evicting an instance — drain cleanly. */
async function shutdown(signal: string): Promise<void> {
  console.log(`[HNX-CIS] Received ${signal}, shutting down...`);
  server.close(async () => {
    try {
      await closePool();
    } catch (error) {
      console.error('[HNX-CIS] Error while closing the DB pool:', error);
    }
    process.exit(0);
  });

  // Force-exit if connections do not drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

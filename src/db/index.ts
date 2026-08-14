/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import { env, isDatabaseConfigured } from '../config/env.ts';
import * as schema from './schema.ts';

declare global {
  // eslint-disable-next-line no-var
  var _postgresPool: Pool | undefined;
}

export { schema };

/**
 * Cloud SQL connection.
 *
 * - On Cloud Run, `--add-cloudsql-instances` mounts a Unix socket at
 *   /cloudsql/<project:region:instance>; `pg` connects to it by passing the
 *   directory as `host` (no port, no SSL, no IP allowlist).
 * - Locally, run the Cloud SQL Auth Proxy and set SQL_HOST=127.0.0.1.
 */
export function buildPoolConfig(): PoolConfig {
  const base: PoolConfig = {
    user: env.db.user,
    password: env.db.password,
    database: env.db.name,
    max: env.db.maxPoolSize,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
  };

  if (env.db.instanceConnectionName) {
    return { ...base, host: `${env.db.socketPathPrefix}/${env.db.instanceConnectionName}` };
  }

  return {
    ...base,
    host: env.db.host,
    port: env.db.port,
    ssl: env.db.ssl ? { rejectUnauthorized: false } : undefined,
  };
}

export function createPool(): Pool {
  if (!global._postgresPool) {
    const pool = new Pool(buildPoolConfig());
    pool.on('error', (err) => {
      console.error('[db] Unexpected error on idle Postgres client:', err);
    });
    global._postgresPool = pool;
  }
  return global._postgresPool;
}

let dbInstance: NodePgDatabase<typeof schema> | null = null;

/**
 * Lazily opens the pool so the service still boots (and answers health checks)
 * when the database is not configured yet — important for the first Cloud Run
 * revision, which is deployed before Cloud SQL is wired up.
 */
export function getDb(): NodePgDatabase<typeof schema> {
  if (!isDatabaseConfigured) {
    throw new Error(
      'Database is not configured. Set SQL_DB_NAME, SQL_USER and either INSTANCE_CONNECTION_NAME (Cloud SQL) or SQL_HOST.',
    );
  }
  if (!dbInstance) {
    dbInstance = drizzle(createPool(), { schema });
  }
  return dbInstance;
}

/** Cheap liveness probe used by /api/health/db. */
export async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
  const startedAt = process.hrtime.bigint();
  await createPool().query('SELECT 1');
  const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  return { ok: true, latencyMs: Math.round(latencyMs) };
}

export async function closePool(): Promise<void> {
  if (global._postgresPool) {
    await global._postgresPool.end();
    global._postgresPool = undefined;
    dbInstance = null;
  }
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';

// On Cloud Run the variables come from the service config / Secret Manager;
// locally they come from a .env file.
dotenv.config();

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : undefined;
}

function bool(name: string, fallback = false): boolean {
  const value = optional(name);
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function list(name: string): string[] {
  const value = optional(name);
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: optional('NODE_ENV') ?? 'development',
  isProduction: (optional('NODE_ENV') ?? 'development') === 'production',

  /** Cloud Run always injects PORT; 8080 is its default contract. */
  port: Number(optional('PORT') ?? 8080),

  /**
   * Allowed browser origins, comma-separated, e.g.
   * "https://hnxcis-frontend-xxxx.a.run.app,http://localhost:5173".
   * Empty => reflect any origin (development convenience only).
   */
  corsOrigins: list('CORS_ORIGINS'),

  gemini: {
    apiKey: optional('GEMINI_API_KEY'),
    model: optional('GEMINI_MODEL') ?? 'gemini-3.6-flash',
  },

  firebase: {
    projectId: optional('FIREBASE_PROJECT_ID') ?? optional('GOOGLE_CLOUD_PROJECT'),
    /** When true, every /api route (except health) requires a valid ID token. */
    authRequired: bool('AUTH_REQUIRED', false),
  },

  db: {
    /**
     * Cloud SQL: "project:region:instance". When set, the pool connects through
     * the Unix socket that Cloud Run mounts at /cloudsql/<connection name>
     * (`gcloud run deploy --add-cloudsql-instances ...`), so no IP allowlisting
     * or proxy sidecar is needed.
     */
    instanceConnectionName: optional('INSTANCE_CONNECTION_NAME'),
    socketPathPrefix: optional('DB_SOCKET_PATH') ?? '/cloudsql',
    host: optional('SQL_HOST') ?? '127.0.0.1',
    port: Number(optional('SQL_PORT') ?? 5432),
    user: optional('SQL_USER'),
    password: optional('SQL_PASSWORD'),
    name: optional('SQL_DB_NAME'),
    /** TCP + public IP without the Cloud SQL proxy needs SSL. */
    ssl: bool('SQL_SSL', false),
    maxPoolSize: Number(optional('SQL_POOL_MAX') ?? 10),
  },
} as const;

/** True when enough is configured to open a Postgres pool. */
export const isDatabaseConfigured = Boolean(
  env.db.name && env.db.user && (env.db.instanceConnectionName || env.db.host),
);

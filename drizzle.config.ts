import * as dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

dotenv.config();

/**
 * Migrations never run inside the Cloud Run container: they are executed from
 * CI (.github/workflows/db-migrate.yml) or from a workstation, both of which
 * reach Cloud SQL through the Cloud SQL Auth Proxy on 127.0.0.1:5432.
 *
 * SQL_ADMIN_USER/SQL_ADMIN_PASSWORD are the migration credentials (owner of the
 * schema); the runtime service uses the lower-privileged SQL_USER.
 */
const host = process.env.SQL_HOST ?? '127.0.0.1';
const port = Number(process.env.SQL_PORT ?? 5432);
const database = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER ?? process.env.SQL_USER;
const password = process.env.SQL_ADMIN_PASSWORD ?? process.env.SQL_PASSWORD;

if (!database) throw new Error('SQL_DB_NAME must be set in environment variables.');
if (!user) throw new Error('SQL_ADMIN_USER (or SQL_USER) must be set in environment variables.');
if (!password) {
  throw new Error('SQL_ADMIN_PASSWORD (or SQL_PASSWORD) must be set in environment variables.');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials: {
    host,
    port,
    user,
    password,
    database,
    ssl: ['1', 'true', 'yes'].includes((process.env.SQL_SSL ?? '').toLowerCase()),
  },
  verbose: true,
  strict: true,
});

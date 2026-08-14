# Drizzle migrations

Generated SQL migrations live here. Do **not** edit the `meta/` journal by hand.

```bash
npm run db:generate   # create a migration from src/db/schema.ts
npm run db:migrate    # apply pending migrations (needs the Cloud SQL Auth Proxy)
```

In CI they are applied by `.github/workflows/db-migrate.yml` (manual dispatch).

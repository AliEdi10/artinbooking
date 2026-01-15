# Database

This folder contains the PostgreSQL schema for the multi-tenant driving school platform. Migrations are ordered to introduce core types and tables, then layer in role-specific profiles, addresses, licence metadata, availability, bookings, and audit history.

Key files:
- `migrations/0001-0007_*.sql`: Apply sequentially to build the schema from scratch.
- `schema.sql`: Reference snapshot of the enums, tables, and intent for indexes/constraints.
- `seeds/`: Optional data to load a platform superadmin plus a sample school with associated users, profiles, addresses, availability, bookings, and audit rows.

## Running migrations locally

1. Ensure Postgres is running and accessible (default DB name `artinbk`, or override with `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT`).
2. Apply migrations in order with `psql`:
   ```bash
   for file in db/migrations/*.sql; do
     psql "$PGDATABASE" -f "$file"
   done
   ```
3. Load seeds (optional):
   ```bash
   psql "$PGDATABASE" -f db/seeds/seed_superadmin.sql
   psql "$PGDATABASE" -f db/seeds/seed_sample_school.sql
   ```
4. To rollback a specific migration, re-run your database from a fresh schema or manually `psql -f` the prior migration state. For lightweight local resets, drop and recreate the database then re-apply the files:
   ```bash
   dropdb "$PGDATABASE" && createdb "$PGDATABASE"
   for file in db/migrations/*.sql; do psql "$PGDATABASE" -f "$file"; done
   ```

> Tip: If you prefer npm scripts, add aliases that wrap the loops above (for example, `"migrate": "bash -lc 'for f in db/migrations/*.sql; do psql \"$PGDATABASE\" -f \"$f\"; done'"`).

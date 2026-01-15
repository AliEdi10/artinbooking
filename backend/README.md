# Backend

This package exposes the Express API for the platform and now includes a Postgres client plus migration utilities.

## Configuration

Set standard Postgres environment variables before running the server or migrations:

- `PGHOST` (default `localhost`)
- `PGPORT` (default `5432`)
- `PGUSER` (default `postgres`)
- `PGPASSWORD`
- `PGDATABASE` (default `artinbk`)
- `PGPOOL_MAX` (optional connection pool size)

JWT / Google Identity Platform configuration:

- `AUTH_ISSUER` (default `https://accounts.google.com`)
- `AUTH_AUDIENCE` (required when validating tokens from Google Identity Platform)
- `AUTH_JWKS_URI` (default `https://www.googleapis.com/oauth2/v3/certs`)
- `AUTH_EMULATOR` (set to `true` to skip JWT verification during local development/tests)
- `AUTH_EMULATOR_EMAIL`, `AUTH_EMULATOR_ROLE`, `AUTH_EMULATOR_DRIVING_SCHOOL_ID` (optional overrides when the emulator is on)
- `AUTH_LOCAL_JWT` (set to `true` to verify RS256 tokens using a local private key instead of Google JWKS)
- `AUTH_LOCAL_PRIVATE_KEY` (PEM or base64-encoded private key used to sign local tokens)
- `AUTH_LOCAL_KEY_ID`, `AUTH_LOCAL_ISSUER`, `AUTH_LOCAL_AUDIENCE`, `AUTH_LOCAL_PROVIDER` (optional overrides for local token metadata)

## Running locally

```bash
npm install
npm run dev
```

### Local auth stub

For quick local testing without Google Identity Platform, enable the auth emulator and point seeds at your database:

```bash
export AUTH_EMULATOR=true
export AUTH_EMULATOR_EMAIL=superadmin@example.com
export AUTH_EMULATOR_ROLE=SUPERADMIN
psql "$PGDATABASE" -f ../db/seeds/seed_superadmin.sql
psql "$PGDATABASE" -f ../db/seeds/seed_sample_school.sql
```

Send any Bearer token when calling the API (e.g. `Authorization: Bearer local-dev`) and the middleware will load the user by email. When connected to Google Identity Platform in non-emulated mode, present a signed ID token for your app client ID and the server will validate issuer/audience via the configured JWKS endpoint.

When `AUTH_LOCAL_JWT=true`, you can mint a signed RS256 token without relying on Google by posting to `/auth/local-token` (local/test use only) or by calling `issueLocalJwt` in code. Tokens are validated against the configured local issuer/audience and private key.

## Migrations

Apply database migrations from the repo-level `db/migrations` folder:

```bash
npm run migrate
```

Override the migrations directory with `MIGRATIONS_DIR` when needed.

## Tests

Integration tests expect Docker to be available; they run a temporary Postgres container, apply migrations, and exercise the `/schools` endpoint.

```bash
npm run test:integration
```

The auth/tenant integration suite (`tests/integration/authz.test.ts`) covers missing/invalid tokens, cross-tenant denial, and role-based restrictions using locally signed JWTs.

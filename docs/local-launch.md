# Local launch guide

Use this guide to run the platform locally with the backend APIs, Postgres, and the Next.js frontend.

## Prerequisites
- Node.js 20+ with npm
- Postgres 14+ reachable on `localhost` (or adjust `PGHOST`/`PGPORT`)
- Git
- Optional: Docker (to run Postgres without installing it locally)

## 1) Start Postgres
You can point to an existing Postgres instance or start one quickly with Docker:

```bash
docker run --name artinbk-postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=artinbk -d postgres:15
```

Export connection variables so both backend and migration scripts pick them up:

```bash
export PGHOST=localhost
export PGPORT=5432
export PGUSER=postgres
export PGPASSWORD=postgres
export PGDATABASE=artinbk
```

## 2) Install dependencies
Run installs from the repo root:

```bash
cd backend
npm install
cd ../frontend
npm install
cd ..
```

## 3) Apply migrations
Apply the database schema from the shared `db/migrations` directory:

```bash
cd backend
npm run migrate
cd ..
```

## 4) Seed quick-start data (optional)
Add a superadmin user plus a sample school for easier login and testing:

```bash
psql "$PGDATABASE" -f db/seeds/seed_superadmin.sql
psql "$PGDATABASE" -f db/seeds/seed_sample_school.sql
```

## 5) Run the backend with local auth
Enable the auth emulator for fast local development (skips Google Identity Platform validation) and start the API server:

```bash
cd backend
export AUTH_EMULATOR=true
export AUTH_EMULATOR_EMAIL=superadmin@example.com
export AUTH_EMULATOR_ROLE=SUPERADMIN
npm run dev
```

The API listens on http://localhost:3001.

## 6) Run the frontend
In a second terminal, point the frontend at the local backend and start Next.js:

```bash
cd frontend
export NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
npm run dev
```

Open http://localhost:3000. Visit `/login`, enter any token string, and proceed—the backend emulator will trust the `AUTH_EMULATOR` context and route guards will populate the SUPERADMIN role.

## 7) Calling authenticated APIs directly (optional)
If you prefer a structured JWT instead of the emulator, start the backend, then request a local token:

```bash
curl -X POST http://localhost:3001/auth/local-token \
  -H 'Content-Type: application/json' \
  -d '{"email":"superadmin@example.com","role":"SUPERADMIN","schoolId":"school-1"}'
```

Copy the `token` field from the response and present it as `Authorization: Bearer <token>` in API calls or paste it into the frontend login form via **Use local token**.

## 8) Stopping services
- Stop the backend/frontend dev servers with `Ctrl+C`.
- If you started the Dockerized Postgres, stop and remove it with:

```bash
docker stop artinbk-postgres && docker rm artinbk-postgres
```

## 9) Troubleshooting
- Ensure Postgres is running and reachable on the configured host/port.
- Clear `localStorage` in the browser if switching between emulator and real tokens.
- Re-run migrations after pulling schema changes.
- Use `npm run test:integration` from `backend` when Docker is available to validate DB connectivity and auth guards.

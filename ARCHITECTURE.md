# Architecture overview

This repository contains three main packages plus infra assets:

- `db/` – Postgres DDL and migrations (applied via backend scripts) plus seed helpers.
- `backend/` – Express API in TypeScript with authentication/authorization middleware, Postgres client, and booking/availability logic.
- `frontend/` – Next.js 13+ app with role-aware dashboards and a login flow that accepts Google Identity Platform tokens or locally issued JWTs.
- `infra/` – Deployment scaffolding (Dockerfiles, Cloud Build, Terraform) targeting Google Cloud Run + Cloud SQL + Artifact Registry + Secret Manager + Cloud Storage.

## Data layer (`db/`)
- Migrations live in `db/migrations` and define the current schema for driving schools, users/roles, driver & student profiles, addresses, bookings, availability, and school settings (including lead times and daily caps).
- Seeds under `db/seeds` can insert a superadmin, a sample school, and demo data when combined with the auth emulator/local JWT options.
- Migration scripts are invoked through backend package scripts (see `backend/README.md`).

## Backend (`backend/`)
- Express server (`src/app.ts`) with CORS and JSON parsing.
- Authentication middleware validates RS256 JWTs (Google Identity Platform by default) or uses the emulator/local JWT paths for development. Requests populate `req.user` with role and `drivingSchoolId` for downstream tenant checks.
- Authorization middleware enforces role guards and tenant scoping on routes. Superadmins may cross tenant boundaries; all other roles are restricted to their `driving_school_id`.
- Core routes:
  - `/health`, `/hello` – basic probes.
  - `/auth/local-token` – emits RS256 tokens when `AUTH_LOCAL_JWT=true` (dev/test only).
  - `/schools` – lists schools (scoped to tenant unless SUPERADMIN).
  - `/schools/:schoolId/...` – drivers, students, addresses, invitations, availability, and bookings endpoints with tenant enforcement.
  - Availability and booking flows enforce licence status, service radius, buffers, travel feasibility (Google Maps provider with haversine fallback), lead time, and daily booking caps.
- Integration tests spin up Postgres in Docker, run migrations, and exercise the `/schools` endpoint and auth/tenant guards.

## Frontend (`frontend/`)
- Next.js app with shared `<AuthProvider>` storing JWTs, plus `<Protected>` route guards that check role allowances before rendering pages.
- Pages:
  - `/login` – Google Identity sign-in button and manual JWT entry for local tokens.
  - `/` – overview shell with navigation.
  - `/admin`, `/driver`, `/student`, `/bookings` – dashboards with mocked tables/cards, calling backend APIs where available (e.g., school settings fetch) and falling back to placeholder data.
- Styling uses Tailwind classes co-located in components.

## Infrastructure (`infra/`)
- Root `.dockerignore` plus Dockerfiles for backend and frontend (production builds with TypeScript compilation/Next build).
- `cloudbuild.yaml` builds/pushes images to Artifact Registry and includes a migration placeholder step for future Cloud SQL wiring.
- Terraform modules under `infra/terraform` provision Artifact Registry, Cloud SQL Postgres, Secret Manager, Cloud Storage, and Cloud Run services with IAM bindings. Variables cover auth config, image tags, and networking.
- `infra/README.md` documents apply steps, environment promotion, and remaining wiring for migrations/secrets.

## Local development flow
1. Install dependencies in `backend/` and `frontend/` and apply `db/migrations` via `npm run migrate` in `backend` (Postgres env vars required).
2. Start backend with `npm run dev` (configure auth emulator or Google Identity settings as needed). API listens on `http://localhost:3001`.
3. Start frontend with `npm run dev` in `frontend` (listens on `http://localhost:3000`).
4. Authenticate via `/login`, then browse role-guarded dashboards or call the availability/booking endpoints; mocked UI panels remain for data not yet exposed via APIs.

## Notable gaps / future work
- Frontend dashboards still use mocked data for drivers/students/bookings; wire full CRUD to backend APIs.
- Deployment pipeline needs project-specific values, database migration wiring in Cloud Build, and environment secrets before production cutover.
- Additional test coverage is needed for booking/availability edge cases and UI flows.

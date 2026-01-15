# artinbk

artinbk is a multi-tenant driving school platform. It is built as a Node.js/TypeScript backend (Express) with a Postgres database and migration set, plus a Next.js/TypeScript frontend. The target deployment is Google Cloud (Cloud Run + Cloud SQL + Cloud Storage).

This repository now ships with a working local development environment backed by Postgres, authentication middleware (Google Identity Platform–compatible with an emulator for local use), and booking/availability logic that enforces service-radius and lead-time rules. The `/docs` folder continues to capture the broader product vision and deployment targets.

## 1. Read this first (onboarding order)

After cloning the repo, read documents in this order:

1. `ARCHITECTURE.md`  
   Current high-level architecture and what is already implemented locally.

2. `docs/requirements.md`  
   Product goals, roles, and key functional requirements.

3. `docs/domain-model.md`  
   Main entities (schools, users, drivers, students, bookings, availability, settings) and how they relate.

4. `docs/availability-engine.md`  
   Target behaviour of the travel and availability logic.

5. `docs/gcp-architecture.md`
   Target Google Cloud deployment model and environments.

For a turnkey path to GCP, follow `docs/gcp-launch-guide.md`, which pairs an automation script with manual validation steps.

These documents define what the final application must do and how it is expected to be deployed.

## 2. Local development – quick start

For a step-by-step setup (Postgres via Docker, migrations, auth emulator, and JWT helper), see [`docs/local-launch.md`](docs/local-launch.md).

Prerequisites:

- Git
- Node.js 22.x and npm
- A running Postgres instance (set `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` as needed)
- Docker (optional) for integration tests

Steps:

1. Clone the repository from GitHub.
2. Install dependencies for backend and frontend:

   ```bash
   cd backend
   npm install

   cd ../frontend
   npm install
   ```

3. Apply the database migrations from `db/migrations` using the backend script (defaults to Postgres on `localhost:5432`):

   ```bash
   cd ../backend
   npm run migrate
   ```

   The migration utility reads standard Postgres environment variables. See `backend/README.md` and `db/README.md` for configuration details.

4. Run the backend (set auth emulator vars for quick local calls or configure Google Identity Platform env vars as in `backend/README.md`):

   ```bash
   npm run dev
   ```

   The backend listens on http://localhost:3001 and currently exposes authenticated JSON APIs for schools, drivers, addresses, availability, and bookings. Highlights:

   - `GET /health` – health check
   - `GET /hello` – test endpoint
   - `GET /schools` – returns driving school rows from Postgres via the migration-defined schema
   - `GET /schools/:schoolId/drivers/:driverId/available-slots?date=YYYY-MM-DD&pickupAddressId=...&dropoffAddressId=...` – computes 15-minute slots using working hours/overrides, travel time, service-radius limits, lead-time rules, and daily caps
   - `POST /schools/:schoolId/bookings` – validates service radius, licence status, and lead-time policy before creating a booking

5. In a second terminal, run the frontend:

   ```bash
   cd ../frontend
   npm run dev
   ```

   The frontend listens on http://localhost:3000 and includes:

   - A `/login` screen that accepts Google Identity Platform tokens or locally issued JWTs
   - Protected dashboards for admins (`/admin`), drivers (`/driver`), and students (`/student`)
   - A bookings workspace (`/bookings`) that queries availability/booking APIs when reachable and falls back to mocked data when offline

## 3. Current scope vs. future work

Implemented:

- Mono-repo layout with `db/`, `backend/`, `frontend/`
- Postgres schema and migrations under `db/migrations`
- Express backend with CORS enabled, Postgres client, authentication middleware (Google Identity Platform-compatible with a local emulator), and JSON endpoints backed by the database
- Booking and availability workflows that enforce licence status, service-radius rules, travel-time feasibility (Google Maps provider with haversine fallback), lead-time cutoffs, and driver daily booking caps
- Integration tests that spin up Postgres, apply migrations, and validate the `/schools` endpoint
- Next.js frontend with role-aware dashboards (`/admin`, `/driver`, `/student`), a bookings workspace, and a `/login` screen that supports Google Identity Platform tokens or locally issued JWTs
- Documentation describing requirements, domain, availability logic, and target GCP architecture

Not implemented yet (high level):

- Read/write UI for the new dashboards and booking pages. The current screens are read-only and expect backend APIs to be online; creating or updating schools, drivers, students, addresses, and bookings still needs form flows and mutation handlers.
- Frontend test coverage. Add component/e2e tests for login, role-guarded navigation, availability search, booking creation/cancellation, and roster updates.
- Production deployment cutover. Dockerfiles, Cloud Build, and Terraform scaffolding exist under `backend/`, `frontend/`, `cloudbuild.yaml`, and `infra/terraform`, but they still need project-specific wiring, secret values, and CI/CD automation before use, plus post-deploy smoke tests.
- Backend-powered CRUD on the new dashboards and booking pages (currently backed by mocked data when APIs are unavailable)
- Production deployment cutover (Dockerfiles, Cloud Build, and Terraform scaffolding now exist under `backend/`, `frontend/`, `cloudbuild.yaml`, and `infra/terraform`, but they still need project-specific wiring, secret values, and CI/CD automation before use)
- Full frontend experiences beyond the `/schools` list (e.g., dashboards, booking flows)
- Docker, Terraform, Cloud Build, and deployment to GCP

Refer to the documents under `docs/` for the intended end state before starting major implementation work.

# Remaining checklist to finish the app

Use this checklist to track outstanding work before the platform is production-ready. Items are grouped by area and can be tackled independently.

## Frontend validation and UX polish
- Add inline validation and error surfacing for all create/update forms (drivers, students, school settings, addresses, availability, bookings).
- Keep loading, success, and error states consistent across admin/driver/student dashboards and the bookings workspace.
- Apply optimistic updates where safe (e.g., roster edits, address updates) with rollback on failure.
- Harden auth flows: show clear feedback for expired/invalid tokens and redirect unauthenticated users.

## Frontend testing
- Component tests for auth provider, protected routes, navigation guards, and each dashboard data loader.
- End-to-end tests for: login, availability search, booking create/reschedule/cancel, roster create/update, settings edits, and driver availability publishing.
- Add smoke tests for bookings workspace to ensure pickup/dropoff radius and lead-time messaging render as expected.

## Backend and API hardening
- Add request validation for all dashboard write endpoints (drivers, students, settings, availability windows, bookings) and return structured errors consumable by the UI.
- Expand integration tests to cover cross-tenant/role denial paths for new write actions and to verify policy enforcement (service radius, lead time, licence status, daily caps) through the dashboards.
- Monitor auth/JWT expiry and clock-skew handling paths to keep tenant context reliable.

## Deployment and operations
- Populate Terraform variables and secrets per environment (Cloud SQL, Artifact Registry, Google Maps API, auth keys, JWT issuer/audience, storage buckets).
- Extend Cloud Build (or GitHub Actions) to run tests, build/push backend and frontend images, apply migrations, deploy to Cloud Run, and run smoke checks.
- Document promotion/rollback steps and incident runbooks (resetting tokens, rotating keys, rolling back migrations, and redeploying services).
- Add monitoring/alerts around API availability, auth failures, and database connectivity.

## Data and migration hygiene
- Backfill seed data for demo tenants (schools, users, addresses) to support e2e testing and staging environments.
- Add migration tests or linters to ensure schema changes stay aligned with `docs/domain-model.md` and `docs/requirements.md`.

Track progress by checking off items as they land; update `docs/status-report.md` after each milestone to keep the repo state aligned with documentation.

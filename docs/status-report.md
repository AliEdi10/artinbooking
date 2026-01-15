# Status report

## Current state
- Multi-tenant driving school platform with Postgres schema, Express/TypeScript backend, and Next.js frontend. Auth middleware expects Google Identity Platform-compatible JWTs and a local issuer is documented for offline testing.
- Backend exposes tenant-scoped APIs for schools, drivers, students, addresses, availability, and bookings, enforcing service-radius, lead-time, licence status, and driver daily booking caps. Travel time uses Google Maps when configured with a haversine fallback.
- Frontend ships role-guarded dashboards for admins, drivers, students, and bookings that read live backend data when available; UI flows remain read-only.
- Infra scaffolding includes Dockerfiles, Cloud Build config, and Terraform for Cloud Run, Cloud SQL, Artifact Registry, Secret Manager, and Cloud Storage; project-specific values and secrets are still required.

## Gaps to close
- Add create/update/delete flows in the dashboards for drivers, students, addresses, settings, and bookings with inline validation and optimistic UI where sensible.
- Expand frontend test coverage (component and end-to-end) for auth, role guards, availability search, booking create/cancel, and roster management.
- Fill in deployment wiring: set Terraform variables/secrets per environment, extend Cloud Build (or GitHub Actions) to run tests, build images, apply migrations, deploy to Cloud Run, and add smoke checks and rollback steps.

Use this checklist to guide the next iteration and align changes with the documented requirements and domain model.

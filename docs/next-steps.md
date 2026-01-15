# Next steps after dashboard wiring

The dashboards now load live tenant-scoped data from the backend. The following items are the highest-value next steps to make the app usable end-to-end and production ready:

1. **Add write flows for admins.**
   - Build create/edit forms for drivers, students, and school settings under `/admin`.
   - Wire POST/PATCH/DELETE calls to the existing backend APIs and surface inline validation errors.
   - Allow admins to cancel or reschedule bookings with policy enforcement reflected in UI messaging.

2. **Enable driver and student actions.**
   - Allow drivers to publish and edit availability, accept/cancel bookings, and view travel/policy feedback for each change.
   - Let students manage addresses, upload licence details, and create/cancel bookings using the availability flow.

3. **Add frontend test coverage.**
   - Implement component tests for the auth provider, protected routes, and dashboard data loaders.
   - Add e2e flows for login, availability search, booking creation, booking cancellation, and roster updates.

4. **Finish deployment wiring.**
   - Populate Terraform variables and secrets (Cloud SQL, Artifact Registry, Google Maps, auth keys) for dev/staging/prod.
   - Extend Cloud Build (or GitHub Actions) to run tests, build images, run migrations, and deploy to Cloud Run, followed by smoke checks.
   - Document promotion steps and rollback procedures.

Use this checklist to track work for the next iteration and to align changes with the documented requirements in `docs/requirements.md` and `docs/domain-model.md`.

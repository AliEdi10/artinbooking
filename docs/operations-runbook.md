# Operations runbook

This runbook keeps support and on-call teams aligned on how to promote builds, apply database migrations safely, and reach private services when triaging incidents.

## Environments and promotion

- **Promotion path:** dev → staging → prod. Promote the same image tag through each environment after it passes smoke tests.
- **Build + deploy:**
  1. Trigger Cloud Build with substitutions for the target environment and image tag:
     ```bash
     gcloud builds submit --config cloudbuild.yaml \
       --substitutions _ENV=staging,_REGION=us-central1,_IMAGE_TAG=v2024-05-01
     ```
  2. Run Terraform with the matching workspace and tfvars file to refresh Cloud Run revisions, secrets, scheduler jobs, and monitoring:
     ```bash
     cd infra/terraform
     terraform init -backend-config="bucket=${PROJECT}-tf-state" -backend-config="prefix=artinbk/staging"
     terraform workspace select staging
     terraform apply -var-file=envs/staging.tfvars -var image_tag=v2024-05-01
     ```
  3. Verify smoke checks (health endpoint + frontend landing page) before promoting to the next environment using the same tag.

## Rollback

- **Application rollback:**
  - Redeploy the last known-good image tag via Cloud Build substitutions (same as promotion but with the previous tag), or pin the Cloud Run service to the prior revision in the console if urgent.
  - Re-run Terraform with `-var image_tag=<prior-tag>` to ensure services and jobs align with the rolled-back image and secrets.
- **Database rollback:**
  - Prefer forward fixes; only use rollback when migrations are guaranteed reversible.
  - If a reversible migration caused issues, run the paired down migration via the migration runner (see below) or apply the previous migration snapshot manually after confirming no data loss risk.

## Migration sequencing

- **Authoring:** keep migrations strictly ordered; every change requires an `N+1` SQL file in `db/migrations`. Include reversible statements when feasible.
- **Pre-deploy:**
  - Review new migrations against production constraints (locking risk, long-running indexes). For large changes, plan `CREATE INDEX CONCURRENTLY`/`DROP ... CONCURRENTLY` and schedule low-traffic windows.
  - Dry-run locally or against a staging clone using the migration runner scripts in `db/scripts`.
- **Deploy:**
  - Cloud Build can invoke a Cloud Run Job (built from the backend image) that runs the migration script against the Cloud SQL instance. Ensure DB credentials/connection name are supplied via Secret Manager env vars.
  - If running manually, connect with the Cloud SQL Auth Proxy (see Access methods) and apply the migration files sequentially with `psql`.
- **Post-deploy:**
  - Confirm schema version and critical invariants (row counts, foreign keys, recent bookings) via read-only queries.
  - Update the runbook with any corrective steps if a migration requires manual follow-up.

## Access methods (for support/DBA tasks)

- **Cloud SQL Auth Proxy (preferred):**
  ```bash
  export INSTANCE="projects/${PROJECT}/locations/${REGION}/instances/${INSTANCE_NAME}"
  ./cloud_sql_proxy -instances="$INSTANCE"=localhost:5432
  PGPASSWORD=$(gcloud secrets versions access latest --secret=db-password) \
    psql -h 127.0.0.1 -U app -d artinbk
  ```
- **Bastion/SSH (if proxy unavailable):**
  - Use the VPC-connected bastion host with IAM or OS Login. From the bastion, connect to the private IP of the Cloud SQL instance with `psql`.
  - Keep bastion groups restricted; rotate SSH keys/OS Login access after incidents.
- **Read-only patterns:** prefer read-only users for investigations; grant temporary elevated roles only when changes are required.

## Data readiness and seeding

- **Staging data:** load `db/seeds/seed_superadmin.sql` and `db/seeds/seed_sample_school.sql` after migrations to supply demo tenants, addresses, availability, and bookings. Refresh regularly to keep E2E tests stable.
- **Prod safety:** never load seed data in production. For reproducing prod issues, export a minimal, anonymized slice to staging (remove PII, rotate tokens/licence images).
- **Verification:** after seeding, run smoke tests: login with seeded users, confirm availability search returns slots, and execute a create → reschedule → cancel booking flow.

## Incident quick-actions

- Check Cloud Run error rates and latency in Cloud Monitoring; correlate with recent deployments or migrations.
- Tail the backend Cloud Run logs (or the BigQuery log sink) for request IDs from affected users.
- If the backend is unhealthy, pause scheduler pings to reduce noise until the service recovers.
- Document the remediation in this runbook for future rotations.

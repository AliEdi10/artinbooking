# Deployment tooling (GCP)

This folder contains the deployment artifacts for running artinbk on Google Cloud.

## Docker images
- `backend/Dockerfile` builds the Express API with TypeScript compilation and production-only dependencies.
- `frontend/Dockerfile` builds the Next.js app and serves it with `next start`.
- The root `.dockerignore` keeps images slim by skipping build caches, node_modules, and local env files.

### Bootstrap automation
- `infra/scripts/gcp-bootstrap.sh` enables required APIs, creates the Artifact Registry repo, provisions the Terraform state bucket, grants Cloud Build deploy roles, and seeds placeholder Secret Manager entries per environment. Run it before Terraform/Cloud Build to remove manual toil.
- See `docs/gcp-launch-guide.md` for the combined automation + manual playbook covering secrets, Terraform, Cloud Build submissions, and promotion checks.

## Cloud Build pipeline
- `cloudbuild.yaml` now ships a promotion-ready pipeline per environment that:
  - Builds and pushes backend/frontend images to the Artifact Registry repo for the selected environment.
  - Deploys the images to Cloud Run with the supplied tags and region.
  - Executes DB migrations as a Cloud Run Job (after the job is defined in the backend image) and runs health-check smoke tests.
- Substitutions `_ENV`, `_REGION`, and `_IMAGE_TAG` keep the same YAML reusable across dev/staging/prod.

## Terraform stack
- Located in `infra/terraform` and provisions:
  - Environment-scoped Artifact Registry repository for images.
  - Cloud SQL Postgres instance on private IP with VPC peering, database, and user.
  - Secret Manager entries for backend/frontend env vars.
  - Cloud Storage buckets for assets and licence uploads.
  - Cloud Run services for backend (private invoker) and frontend (public), with IAM bindings, optional domain mappings, and dedicated runtime/scheduler service accounts.
  - Cloud Scheduler keep-alive job hitting the backend with OIDC auth.
  - Monitoring: uptime check + alerting for uptime, p95 latency, 5xx rate, and a BigQuery log sink for Cloud Run logs.
- Key variables in `variables.tf` cover project, environment, region, DB settings, auth config, maps API key, image tags, scheduler paths, and optional custom domains.
- Sample tfvars are provided in `infra/terraform/envs/{dev,staging,prod}.tfvars`.

### Apply steps
1. Create or reuse a VPC with Private Service Connect for Cloud SQL and pass its self link via `vpc_self_link`. The module allocates a peering range automatically.
2. Authenticate to GCP and set the project: `gcloud auth application-default login && gcloud config set project <project>`.
3. Use isolated backends/workspaces per environment. Example:
   ```sh
   cd infra/terraform
   terraform init -backend-config="bucket=${PROJECT}-tf-state" -backend-config="prefix=artinbk/${ENV}"
   terraform workspace new ${ENV} || terraform workspace select ${ENV}
   terraform apply -var-file=envs/${ENV}.tfvars
   ```
4. Provide Secret Manager values for the backend/frontend env maps before deployment.
5. After apply, schedule DNS validation for optional domain mappings and confirm the uptime check is green.

### Promotion and releases
- Use unique image tags per environment (e.g., `dev`, `staging`, `prod`) and pass via `-var image_tag=<tag>` and `_IMAGE_TAG` in Cloud Build.
- Deploy by running Cloud Build with `_ENV=<env>` then `terraform apply -var-file=envs/<env>.tfvars` to roll services and refresh secret versions.
- After deployment, run smoke checks (the pipeline also hits health endpoints):
  - Call the backend health endpoint.
  - Load the frontend URL to ensure it reaches the deployed backend.
- Promote by repeating the build/apply sequence in the next environment using the same image tag.

### Operations runbook
- See `docs/operations-runbook.md` for promotion/rollback drills, migration sequencing expectations, access to Cloud SQL via proxy or bastion, and data seeding guidance.

## Remaining wiring
- Connect the migration step in `cloudbuild.yaml` to the Cloud SQL instance (via proxy, Cloud SQL Auth Proxy, or a dedicated Cloud Run Job) before automated deploys.
- Add per-environment Secret Manager values matching your auth provider and backend URL; Terraform loads them into Cloud Run at deploy time.
- Provide required IAM bindings for monitoring/alerting notification channels if you add them to the Terraform stack.

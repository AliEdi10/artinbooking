# GCP launch guide (automated + manual)

Use this guide to prepare a project for Cloud Run/Cloud SQL and deploy the app. It combines automation (bootstrapping script + Cloud Build) with manual checks.

## Prerequisites
- `gcloud` and `gsutil`
- Terraform >= 1.5
- Access to the target project with permissions to enable APIs, manage IAM, Secret Manager, Artifact Registry, Cloud Run, and Cloud SQL
- A VPC with Private Service Connect enabled for Cloud SQL (pass its self link to Terraform as `vpc_self_link`)

## 1) One-time bootstrap (automation)
The `infra/scripts/gcp-bootstrap.sh` script enables APIs, creates the Artifact Registry repo, initializes a Terraform state bucket, grants Cloud Build deployment roles, and seeds placeholder secrets.

```bash
export PROJECT_ID=<gcp-project>
export REGION=us-central1
export ENV=dev
export TF_STATE_BUCKET=${PROJECT_ID}-tf-state # optional override
export VPC_SELF_LINK=<projects/.../global/networks/...>

./infra/scripts/gcp-bootstrap.sh
```

What it does:
- Enables all APIs used by Cloud Run, Cloud SQL, Artifact Registry, Secret Manager, Cloud Build, Scheduler, Monitoring, Logging, and Domains.
- Creates `artinbk-${ENV}-containers` Artifact Registry repo (Docker) in the chosen region.
- Creates a versioned GCS bucket for Terraform state (idempotent).
- Grants the Cloud Build service account deploy permissions (Run admin, SA user, Artifact Registry writer, Storage admin for state bucket).
- Creates `backend-env-${ENV}` and `frontend-env-${ENV}` secrets with empty JSON payloads so Cloud Build can reference them.

## 2) Prepare environment variables
Update Secret Manager with real environment maps before deploying:

```bash
# Backend env map (YAML encoded by Terraform; keep JSON here for convenience)
cat <<'JSON' > /tmp/backend-env.json
{
  "PORT": "8080",
  "DATABASE_URL": "postgresql://<user>:<password>@<private-ip>:5432/app",
  "AUTH_AUDIENCE": "<auth-audience>",
  "AUTH_ISSUER": "<auth-issuer>",
  "AUTH_JWKS_URI": "<jwks-url>",
  "GOOGLE_MAPS_API_KEY": "<maps-api-key>",
  "DEFAULT_SERVICE_RADIUS_KM": "15"
}
JSON

gcloud secrets versions add backend-env-${ENV} --data-file=/tmp/backend-env.json --project=${PROJECT_ID}

# Frontend env map
cat <<'JSON' > /tmp/frontend-env.json
{
  "NEXT_PUBLIC_BACKEND_BASE_URL": "https://artinbk-${ENV}-backend-<random>.a.run.app"
}
JSON

gcloud secrets versions add frontend-env-${ENV} --data-file=/tmp/frontend-env.json --project=${PROJECT_ID}
```

## 3) Terraform apply (per environment)
Use the provided tfvars to set project, region, VPC, and image tags. Adjust `envs/<env>.tfvars` as needed.

```bash
cd infra/terraform
terraform init -backend-config="bucket=${TF_STATE_BUCKET}" -backend-config="prefix=artinbk/${ENV}"
terraform workspace new ${ENV} || terraform workspace select ${ENV}
terraform apply -var-file=envs/${ENV}.tfvars \
  -var "project_id=${PROJECT_ID}" \
  -var "region=${REGION}" \
  -var "environment=${ENV}" \
  -var "vpc_self_link=${VPC_SELF_LINK}" \
  -var "image_tag=${IMAGE_TAG:-latest}"
```

Outputs include the Cloud Run URLs for backend/frontend. If using custom domains, complete DNS validation after apply.

## 4) Build and deploy via Cloud Build (automation)
Run Cloud Build once images are tagged. This pipeline builds/pushes images, updates Cloud Run services, optionally runs migrations as a Cloud Run Job, and performs smoke checks.

```bash
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_ENV=${ENV},_REGION=${REGION},_IMAGE_TAG=${IMAGE_TAG},_RUN_MIGRATIONS=true,\
_BACKEND_URL=$(terraform output -raw backend_url),_FRONTEND_URL=$(terraform output -raw frontend_url)
```

Notes:
- The first deploy expects the services (`artinbk-${ENV}-backend` and `artinbk-${ENV}-frontend`) to exist. If Terraform hasn’t created them yet, apply Terraform first so IAM and Scheduler wiring are present.
- Set `_RUN_MIGRATIONS=true` to run the migration job. The backend image must include the Cloud Run Job entrypoint.
- `_HEALTH_PATH` defaults to `/health`; adjust if you add a different probe.

## 5) Manual checks and validation
- Confirm uptime check and alerting policies are green in Cloud Monitoring.
- Verify Cloud Run services respond:
  - `curl $(terraform output -raw backend_url)/health`
  - Load the frontend URL and ensure it reaches the backend.
- Confirm Cloud SQL has private IP connectivity from Cloud Run (no public address).
- For custom domains, verify DNS A/AAAA records and SSL status in Cloud Run domain mappings.

## 6) Promotion flow
- Use immutable image tags per release (`git sha` recommended). Promote by reusing the same tag across envs.
- Re-run Cloud Build with the promotion tag and apply Terraform with `-var image_tag=<tag>` in the next workspace.
- After deployment, re-run smoke checks and review Cloud Monitoring dashboards.

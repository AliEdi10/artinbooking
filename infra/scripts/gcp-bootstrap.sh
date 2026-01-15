#!/usr/bin/env bash
set -euo pipefail

# Bootstrap core GCP resources needed before running Terraform/Cloud Build.
# Required env vars:
#   PROJECT_ID: target GCP project
#   REGION: GCP region (e.g., us-central1)
#   ENV: environment name (dev|staging|prod)
# Optional:
#   TF_STATE_BUCKET: name for Terraform state bucket (defaults to ${PROJECT_ID}-tf-state)
#   VPC_SELF_LINK: self link for an existing VPC with Private Service Connect (required for Cloud SQL private IP)

if [[ -z "${PROJECT_ID:-}" || -z "${REGION:-}" || -z "${ENV:-}" ]]; then
  echo "PROJECT_ID, REGION, and ENV are required" >&2
  exit 1
fi

TF_STATE_BUCKET=${TF_STATE_BUCKET:-"${PROJECT_ID}-tf-state"}
REPO_ID="artinbk-${ENV}-containers"

# 1) Enable required APIs
APIS=(
  run.googleapis.com
  artifactregistry.googleapis.com
  sqladmin.googleapis.com
  compute.googleapis.com
  servicenetworking.googleapis.com
  secretmanager.googleapis.com
  iam.googleapis.com
  cloudbuild.googleapis.com
  cloudscheduler.googleapis.com
  logging.googleapis.com
  monitoring.googleapis.com
  bigquery.googleapis.com
  domains.googleapis.com
)

echo "Enabling APIs..."
gcloud services enable "${APIS[@]}" --project "$PROJECT_ID"

# 2) Create Artifact Registry repository (idempotent)
if ! gcloud artifacts repositories describe "$REPO_ID" --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Creating Artifact Registry repo $REPO_ID..."
  gcloud artifacts repositories create "$REPO_ID" \
    --repository-format=DOCKER \
    --location="$REGION" \
    --description="artinbk images (${ENV})" \
    --project="$PROJECT_ID"
else
  echo "Artifact Registry repo $REPO_ID already exists"
fi

# 3) Create Terraform state bucket
if ! gsutil ls -b "gs://${TF_STATE_BUCKET}" >/dev/null 2>&1; then
  echo "Creating Terraform state bucket gs://${TF_STATE_BUCKET}..."
  gsutil mb -l "$REGION" "gs://${TF_STATE_BUCKET}"
  gsutil versioning set on "gs://${TF_STATE_BUCKET}"
else
  echo "Terraform state bucket gs://${TF_STATE_BUCKET} already exists"
fi

# 4) Grant Cloud Build deploy permissions
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

echo "Granting deploy roles to Cloud Build service account ${CLOUD_BUILD_SA}..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin" \
  --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/artifactregistry.writer" \
  --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/storage.admin" \
  --quiet

# 5) Create placeholder secrets for backend/frontend envs
BACKEND_SECRET="backend-env-${ENV}"
FRONTEND_SECRET="frontend-env-${ENV}"

for SECRET in "$BACKEND_SECRET" "$FRONTEND_SECRET"; do
  if ! gcloud secrets describe "$SECRET" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "Creating Secret Manager secret ${SECRET}..."
    gcloud secrets create "$SECRET" --replication-policy="automatic" --project="$PROJECT_ID"
    echo "{}" | gcloud secrets versions add "$SECRET" --data-file=- --project="$PROJECT_ID"
  else
    echo "Secret ${SECRET} already exists"
  fi
done

echo "\nBootstrap complete. Next steps:"
echo "1) Populate Secret Manager versions with real env maps (backend/front)."
echo "2) Run Terraform from infra/terraform using envs/${ENV}.tfvars (vpc_self_link required: ${VPC_SELF_LINK:-<set>})."
echo "3) Submit Cloud Build with substitutions: _ENV=${ENV}, _REGION=${REGION}, _IMAGE_TAG=<tag>."

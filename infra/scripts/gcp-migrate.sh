#!/usr/bin/env bash
set -euo pipefail

# End-to-end automation for migrating/deploying artinbk to Google Cloud.
# It orchestrates bootstrap (APIs + state + permissions), secrets, Terraform apply,
# Cloud Build deploy, and post-deploy smoke checks.
#
# Required environment variables:
#   PROJECT_ID       - target GCP project id
#   REGION           - GCP region (e.g., us-central1)
#   ENV              - environment name (dev|staging|prod)
#   VPC_SELF_LINK    - self link for an existing VPC with Private Service Connect
# Optional:
#   TF_STATE_BUCKET  - overrides the Terraform state bucket name (default: <project>-tf-state)
#   IMAGE_TAG        - image tag to deploy (default: latest)
#   RUN_MIGRATIONS   - set to true to execute the migration Cloud Run Job (default: false)
#   HEALTH_PATH      - override backend health path for smoke checks (default: /health)
#   BACKEND_ENV_FILE - path to JSON file containing backend env map to upload to Secret Manager
#   FRONTEND_ENV_FILE- path to JSON file containing frontend env map to upload to Secret Manager
#   SKIP_BOOTSTRAP   - set to 1 to skip running gcp-bootstrap.sh (if already bootstrapped)

ensure_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

for cmd in gcloud terraform; do
  ensure_cmd "$cmd"
done

if [[ -z "${PROJECT_ID:-}" || -z "${REGION:-}" || -z "${ENV:-}" || -z "${VPC_SELF_LINK:-}" ]]; then
  echo "PROJECT_ID, REGION, ENV, and VPC_SELF_LINK are required" >&2
  exit 1
fi

TF_STATE_BUCKET=${TF_STATE_BUCKET:-"${PROJECT_ID}-tf-state"}
IMAGE_TAG=${IMAGE_TAG:-latest}
RUN_MIGRATIONS=${RUN_MIGRATIONS:-false}
HEALTH_PATH=${HEALTH_PATH:-/health}
BACKEND_SECRET="backend-env-${ENV}"
FRONTEND_SECRET="frontend-env-${ENV}"

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/../.." && pwd)

if [[ "${SKIP_BOOTSTRAP:-0}" != "1" ]]; then
  echo "Running bootstrap script (apis, registry, state bucket, roles, placeholder secrets)..."
  PROJECT_ID="$PROJECT_ID" REGION="$REGION" ENV="$ENV" TF_STATE_BUCKET="$TF_STATE_BUCKET" VPC_SELF_LINK="$VPC_SELF_LINK" \
    "${SCRIPT_DIR}/gcp-bootstrap.sh"
else
  echo "Skipping bootstrap (SKIP_BOOTSTRAP=1)"
fi

ensure_secret() {
  local name=$1
  if ! gcloud secrets describe "$name" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "Creating Secret Manager secret ${name}..."
    gcloud secrets create "$name" --replication-policy="automatic" --project="$PROJECT_ID"
  else
    echo "Secret ${name} already exists"
  fi
}

push_secret_if_file() {
  local name=$1
  local file=$2
  if [[ -n "$file" ]]; then
    if [[ ! -f "$file" ]]; then
      echo "Secret file ${file} not found" >&2
      exit 1
    fi
    echo "Adding secret version for ${name} from ${file}..."
    gcloud secrets versions add "$name" --data-file="$file" --project="$PROJECT_ID"
  else
    echo "No file provided for ${name}; skipping version upload"
  fi
}

echo "Ensuring secrets exist..."
ensure_secret "$BACKEND_SECRET"
ensure_secret "$FRONTEND_SECRET"

push_secret_if_file "$BACKEND_SECRET" "${BACKEND_ENV_FILE:-}"
push_secret_if_file "$FRONTEND_SECRET" "${FRONTEND_ENV_FILE:-}"

cd "$REPO_ROOT/infra/terraform"

echo "Initializing Terraform backend (bucket=${TF_STATE_BUCKET})..."
terraform init -reconfigure -backend-config="bucket=${TF_STATE_BUCKET}" -backend-config="prefix=artinbk/${ENV}"

echo "Selecting/creating workspace ${ENV}..."
terraform workspace new "${ENV}" 2>/dev/null || terraform workspace select "${ENV}"

echo "Applying Terraform for ${ENV}..."
terraform apply -auto-approve \
  -var-file="envs/${ENV}.tfvars" \
  -var "project_id=${PROJECT_ID}" \
  -var "region=${REGION}" \
  -var "environment=${ENV}" \
  -var "vpc_self_link=${VPC_SELF_LINK}" \
  -var "image_tag=${IMAGE_TAG}"

BACKEND_URL=$(terraform output -raw backend_url)
FRONTEND_URL=$(terraform output -raw frontend_url)

cd "$REPO_ROOT"

echo "Submitting Cloud Build for ${ENV} (image tag: ${IMAGE_TAG})..."
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_ENV=${ENV},_REGION=${REGION},_IMAGE_TAG=${IMAGE_TAG},_RUN_MIGRATIONS=${RUN_MIGRATIONS},_BACKEND_URL=${BACKEND_URL},_FRONTEND_URL=${FRONTEND_URL},_HEALTH_PATH=${HEALTH_PATH}

echo "Running smoke checks..."
curl -f "${BACKEND_URL}${HEALTH_PATH}"
curl -f "${FRONTEND_URL}"

echo "Migration/deploy complete for ${ENV}. Backend: ${BACKEND_URL} | Frontend: ${FRONTEND_URL}"

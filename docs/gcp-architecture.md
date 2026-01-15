\# artinbk – Target Google Cloud Architecture



This document outlines the intended GCP architecture for artinbk. It is the target state to be implemented using Terraform and Cloud Build.



\## 1. High-level components



The application is deployed as:



\- Backend API: Node.js/TypeScript (Express or similar) running on Cloud Run.

\- Frontend: Next.js application running on Cloud Run (SSR/SPA) or served as static assets behind Cloud Run / Cloud CDN.

\- Database: Cloud SQL for PostgreSQL.

\- File storage: Google Cloud Storage (GCS) for licence images and any other binary files.

\- CI/CD: Cloud Build triggered from GitHub repository changes.

\- Infrastructure as code: Terraform managing all core GCP resources.



\## 2. Projects and environments



Recommended structure:



\- One GCP project per environment:

&nbsp; - artinbk-dev

&nbsp; - artinbk-staging

&nbsp; - artinbk-prod



Each project contains its own Cloud SQL instance, Cloud Run services and storage buckets. Terraform workspaces or separate state files can be used to manage environments.



\## 3. Network and security



\- Use a VPC network per project, with private IP for Cloud SQL.

\- Restrict database access so only the Cloud Run backend (and admin tools) can connect.

\- Use service accounts for:

&nbsp; - Backend Cloud Run service.

&nbsp; - Frontend Cloud Run service.

&nbsp; - Cloud Build pipelines.

\- Grant least-privilege IAM roles to each service account:

&nbsp; - Backend service account:

&nbsp;   - Cloud SQL Client.

&nbsp;   - Access to specific GCS bucket for licence files.

&nbsp; - Frontend service account:

&nbsp;   - Minimal access, typically no direct DB access.

&nbsp; - Cloud Build service account:

&nbsp;   - Permissions to deploy Cloud Run services and run migrations.



\## 4. Cloud Run services



Two primary services:



1\) backend-service

&nbsp;  - Container image built from backend Dockerfile.

&nbsp;  - Environment variables for:

&nbsp;    - DATABASE\_URL or equivalent connection information.

&nbsp;    - JWT secret or identity provider configuration.

&nbsp;    - GCS bucket names.

&nbsp;    - Any feature flags.

&nbsp;  - Scaled automatically based on traffic; minimum instances configured per environment.



2\) frontend-service

&nbsp;  - Container image built from frontend Dockerfile (Next.js).

&nbsp;  - Configured with backend base URL (for example, https://api.artinbk.example.com).

&nbsp;  - Optionally fronted by Cloud CDN if needed.



Both services expose HTTPS endpoints. Domain mapping will be set up (for example, app.artinbk.com, api.artinbk.com).



\## 5. Cloud SQL (PostgreSQL)



\- One managed PostgreSQL instance per environment.

\- Databases:

&nbsp; - artinbk (primary app database).

\- Access:

&nbsp; - Only accessible via private IP from the backend Cloud Run service or authorised admin connections (Cloud SQL Auth Proxy, bastion, etc.).

\- Schema:

&nbsp; - Managed via SQL migrations checked into the db/migrations folder.

&nbsp; - Migrations applied by a migration runner job, either:

&nbsp;   - Via Cloud Build step, or

&nbsp;   - Via a dedicated Cloud Run job / Cloud Scheduler trigger.



\## 6. Cloud Storage (licence images)



\- A dedicated bucket per environment, for example:

&nbsp; - artinbk-dev-licenses

&nbsp; - artinbk-staging-licenses

&nbsp; - artinbk-prod-licenses



Usage:



\- Store licence images keyed by student\_id and a generated file name.

\- Only the backend service account has permission to read/write objects.

\- Students access uploaded images indirectly via signed URLs or via processed thumbnails, not direct public URLs.



\## 7. CI/CD with Cloud Build



Cloud Build configurations (to be stored under infra/ or at repo root) will define:



\- Backend pipeline:

&nbsp; - Trigger: push to main branch (or a release branch).

&nbsp; - Steps:

&nbsp;   - Build backend Docker image.

&nbsp;   - Push image to Artifact Registry.

&nbsp;   - Run database migrations (for example, using db/scripts/migrate.ts).

&nbsp;   - Deploy new image to backend Cloud Run service.



\- Frontend pipeline:

&nbsp; - Trigger: push to main branch (or frontend-related paths).

&nbsp; - Steps:

&nbsp;   - Build frontend Docker image.

&nbsp;   - Push image to Artifact Registry.

&nbsp;   - Deploy new image to frontend Cloud Run service.



\- Optional migrations-only pipeline:

&nbsp; - Triggered manually or when db/ changes.

&nbsp; - Runs migrations without a new app deploy.



\## 8. Terraform layout



Under infra/terraform/, the target files will include:



\- main.tf: provider configuration, remote state configuration, project-wide resources.

\- variables.tf and outputs.tf: input variables (project ID, region, etc.) and outputs.

\- cloudsql.tf: Cloud SQL instances, users, database configuration.

\- cloudrun\_backend.tf: backend Cloud Run service, IAM bindings, environment variables.

\- cloudrun\_frontend.tf: frontend Cloud Run service configuration.

\- storage.tf: GCS buckets for licence images and other assets.

\- scheduler.tf: Cloud Scheduler jobs (e.g. reminder emails, cleanup tasks).

\- iam.tf: creation and binding of service accounts and roles.



The repo’s db/migrations and backend configuration must be kept in sync with what Terraform provisions.



\## 9. Secrets management



\- Use Secret Manager for:

&nbsp; - JWT signing keys or identity provider secrets.

&nbsp; - Database passwords (if not using IAM database auth).

&nbsp; - Third-party API keys (email, SMS, maps).

\- Backend retrieves secrets via environment variables set from Secret Manager.

\- Secrets are never committed to the repo.



\## 10. Observability



\- Enable Cloud Logging and Cloud Monitoring for all services.

\- Define basic alerts:

&nbsp; - High error rate on backend.

&nbsp; - Elevated latency for booking and availability endpoints.

&nbsp; - Backend or frontend service unavailable.

\- Optionally export logs to BigQuery or another sink for analysis.



This architecture is the target state. The current repository is still local-only; over time, Dockerfiles, Terraform code and Cloud Build configs will be added to bridge from local development to this GCP deployment model.




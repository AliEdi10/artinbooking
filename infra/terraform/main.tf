terraform {
  required_version = ">= 1.5.0"
  backend "gcs" {}
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.30"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  name_prefix  = "artinbk-${var.environment}"
  repo_id      = "${local.name_prefix}-containers"
  sql_instance = "${local.name_prefix}-sql"
  labels = {
    app         = "artinbk"
    environment = var.environment
  }

  backend_env = {
    PORT                      = "8080"
    DATABASE_URL              = var.database_url
    AUTH_AUDIENCE             = var.auth_audience
    AUTH_ISSUER               = var.auth_issuer
    AUTH_JWKS_URI             = var.auth_jwks_uri
    GOOGLE_MAPS_API_KEY       = var.google_maps_api_key
    DEFAULT_SERVICE_RADIUS_KM = tostring(var.default_service_radius_km)
  }

  frontend_env = {
    NEXT_PUBLIC_BACKEND_BASE_URL = var.frontend_backend_base_url
  }
}

resource "google_project_service" "enabled" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "sqladmin.googleapis.com",
    "compute.googleapis.com",
    "servicenetworking.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudscheduler.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "bigquery.googleapis.com",
    "domains.googleapis.com",
  ])
  service = each.key
}

resource "google_compute_global_address" "private_service_range" {
  name          = "${local.name_prefix}-sql-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = var.vpc_self_link
  depends_on    = [google_project_service.enabled]
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = var.vpc_self_link
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_service_range.name]
  depends_on              = [google_project_service.enabled]
}

resource "google_artifact_registry_repository" "containers" {
  location      = var.region
  repository_id = local.repo_id
  description   = "Container images for artinbk services (${var.environment})"
  format        = "DOCKER"
}

resource "google_sql_database_instance" "primary" {
  name             = local.sql_instance
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier = var.db_tier
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_self_link
    }
    backup_configuration {
      enabled = true
    }
    user_labels = local.labels
  }
  depends_on = [google_service_networking_connection.private_vpc_connection]
}

resource "google_sql_database" "app" {
  name     = "app"
  instance = google_sql_database_instance.primary.name
}

resource "google_sql_user" "app" {
  name     = var.db_user
  instance = google_sql_database_instance.primary.name
  password = var.db_password
}

resource "google_secret_manager_secret" "env" {
  for_each  = toset(["backend-env-${var.environment}", "frontend-env-${var.environment}"])
  secret_id = each.key
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "backend_env" {
  secret      = google_secret_manager_secret.env[format("backend-env-%s", var.environment)].name
  secret_data = yamlencode(local.backend_env)
}

resource "google_secret_manager_secret_version" "frontend_env" {
  secret      = google_secret_manager_secret.env[format("frontend-env-%s", var.environment)].name
  secret_data = yamlencode(local.frontend_env)
}

resource "google_storage_bucket" "assets" {
  name                        = "${var.project_id}-${var.environment}-artinbk-assets"
  location                    = var.region
  uniform_bucket_level_access = true
  labels                      = local.labels
}

resource "google_storage_bucket" "licenses" {
  name                        = "${var.project_id}-${var.environment}-artinbk-licenses"
  location                    = var.region
  uniform_bucket_level_access = true
  labels                      = local.labels
}

resource "google_service_account" "scheduler" {
  account_id   = "${local.name_prefix}-scheduler"
  display_name = "${title(var.environment)} scheduler for backend keepalive"
}

resource "google_service_account" "runtime" {
  account_id   = "${local.name_prefix}-runtime"
  display_name = "${title(var.environment)} runtime for Cloud Run services"
}

resource "google_cloud_run_service" "backend" {
  name     = "${local.name_prefix}-backend"
  location = var.region
  labels   = local.labels

  template {
    metadata {
      annotations = {
        "run.googleapis.com/ingress" = "all"
      }
      labels = local.labels
    }
    spec {
      service_account_name = google_service_account.runtime.email
      containers {
        image = "${google_artifact_registry_repository.containers.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.containers.repository_id}/backend:${var.image_tag}"
        env_from {
          secret_ref {
            name = google_secret_manager_secret.env[format("backend-env-%s", var.environment)].secret_id
          }
        }
        ports { container_port = 8080 }
      }
    }
  }

  traffic {
    percent          = 100
    latest_revision  = true
  }
  depends_on = [google_project_service.enabled]
}

resource "google_cloud_run_service" "frontend" {
  name     = "${local.name_prefix}-frontend"
  location = var.region
  labels   = local.labels

  template {
    metadata { labels = local.labels }
    spec {
      containers {
        image = "${google_artifact_registry_repository.containers.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.containers.repository_id}/frontend:${var.image_tag}"
        env_from {
          secret_ref {
            name = google_secret_manager_secret.env[format("frontend-env-%s", var.environment)].secret_id
          }
        }
        ports { container_port = 3000 }
      }
    }
  }

  traffic {
    percent          = 100
    latest_revision  = true
  }
  depends_on = [google_project_service.enabled]
}

resource "google_cloud_run_service_iam_member" "backend_invoker" {
  service  = google_cloud_run_service.backend.name
  location = var.region
  role     = "roles/run.invoker"
  member   = var.backend_invoker_member
}

resource "google_cloud_run_service_iam_member" "frontend_invoker" {
  service  = google_cloud_run_service.frontend.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_service_iam_member" "scheduler_invoker" {
  service  = google_cloud_run_service.backend.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler.email}"
}

resource "google_cloud_scheduler_job" "backend_ping" {
  name        = "${local.name_prefix}-backend-ping"
  description = "Keeps backend warm and can trigger lightweight maintenance"
  schedule    = var.scheduler_schedule
  time_zone   = "UTC"
  region      = var.region

  http_target {
    uri         = "${google_cloud_run_service.backend.status[0].url}${var.scheduler_path}"
    http_method = "GET"
    oidc_token {
      service_account_email = google_service_account.scheduler.email
      audience              = google_cloud_run_service.backend.status[0].url
    }
  }

  depends_on = [google_cloud_run_service.backend]
}

resource "google_cloud_run_domain_mapping" "frontend_domain" {
  count    = length(var.frontend_domain) > 0 ? 1 : 0
  name     = var.frontend_domain
  location = var.region
  metadata { namespace = var.project_id }

  spec {
    route_name = google_cloud_run_service.frontend.name
  }
}

resource "google_cloud_run_domain_mapping" "backend_domain" {
  count    = length(var.backend_domain) > 0 ? 1 : 0
  name     = var.backend_domain
  location = var.region
  metadata { namespace = var.project_id }

  spec {
    route_name = google_cloud_run_service.backend.name
  }
}

resource "google_monitoring_uptime_check_config" "backend" {
  display_name = "${local.name_prefix}-backend-uptime"
  timeout      = "10s"
  period       = "60s"

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = replace(google_cloud_run_service.backend.status[0].url, "https://", "")
    }
  }

  http_check {
    path   = var.uptime_check_path
    port   = 443
    use_ssl = true
  }
}

resource "google_monitoring_alert_policy" "backend_uptime" {
  display_name = "${local.name_prefix}-backend-uptime"
  combiner     = "OR"

  conditions {
    display_name = "Backend uptime check failed"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" resource.type=\"uptime_url\" metric.label.\"check_id\"=\"${google_monitoring_uptime_check_config.backend.uptime_check_id}\""
      duration        = "0s"
      comparison      = "COMPARISON_LT"
      threshold_value = 1
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_NEXT_OLDER"
      }
    }
  }
}

resource "google_monitoring_alert_policy" "backend_latency" {
  display_name = "${local.name_prefix}-backend-latency"
  combiner     = "OR"

  conditions {
    display_name = "p95 latency > 1s"
    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/request_latencies\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"${google_cloud_run_service.backend.name}\""
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = 1000
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }
    }
  }
}

resource "google_monitoring_alert_policy" "backend_errors" {
  display_name = "${local.name_prefix}-backend-5xx"
  combiner     = "OR"

  conditions {
    display_name = "5xx error rate > 5 per minute"
    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/request_count\" metric.label.\"response_code_class\"=\"5xx\" resource.label.\"service_name\"=\"${google_cloud_run_service.backend.name}\""
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields = ["resource.label.\"service_name\""]
      }
    }
  }
}

resource "google_bigquery_dataset" "logs" {
  dataset_id = "artinbk_${var.environment}_logs"
  location   = var.region
  labels     = local.labels
}

resource "google_logging_project_sink" "run_logs" {
  name        = "${local.name_prefix}-run-logs"
  destination = "bigquery.googleapis.com/projects/${var.project_id}/datasets/${google_bigquery_dataset.logs.dataset_id}"
  filter      = "resource.type=\"cloud_run_revision\""
  unique_writer_identity = true
}

resource "google_bigquery_dataset_iam_member" "logs_writer" {
  dataset_id = google_bigquery_dataset.logs.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = google_logging_project_sink.run_logs.writer_identity
}

output "backend_url" {
  value = google_cloud_run_service.backend.status[0].url
}

output "frontend_url" {
  value = google_cloud_run_service.frontend.status[0].url
}

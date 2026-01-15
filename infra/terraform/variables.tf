variable "project_id" {
  description = "GCP project id"
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "region" {
  description = "Deployment region"
  type        = string
  default     = "us-central1"
}

variable "vpc_self_link" {
  description = "Self link of the VPC network for private services"
  type        = string
}

variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-custom-1-3840"
}

variable "db_user" {
  description = "Database username"
  type        = string
  default     = "app"
}

variable "db_password" {
  description = "Database user password"
  type        = string
  sensitive   = true
}

variable "database_url" {
  description = "Database connection string for the backend"
  type        = string
}

variable "auth_audience" {
  description = "Auth audience expected by backend"
  type        = string
}

variable "auth_issuer" {
  description = "Auth issuer expected by backend"
  type        = string
}

variable "auth_jwks_uri" {
  description = "JWKS endpoint for validating tokens"
  type        = string
}

variable "google_maps_api_key" {
  description = "API key for Google Maps distance matrix"
  type        = string
  default     = ""
}

variable "default_service_radius_km" {
  description = "Fallback service radius when driver setting is missing"
  type        = number
  default     = 25
}

variable "frontend_backend_base_url" {
  description = "Backend base URL consumed by the frontend"
  type        = string
}

variable "backend_invoker_member" {
  description = "IAM member allowed to invoke backend (e.g., serviceAccount:xxx)"
  type        = string
}

variable "scheduler_schedule" {
  description = "Cron schedule for backend keep-alive/maintenance job"
  type        = string
  default     = "*/5 * * * *"
}

variable "scheduler_path" {
  description = "HTTP path hit by the Cloud Scheduler job (relative to backend root)"
  type        = string
  default     = "/health"
}

variable "frontend_domain" {
  description = "Optional custom domain for the frontend (omit for none)"
  type        = string
  default     = ""
}

variable "backend_domain" {
  description = "Optional custom domain for the backend (omit for none)"
  type        = string
  default     = ""
}

variable "uptime_check_path" {
  description = "HTTP path used for uptime checks and alerts"
  type        = string
  default     = "/health"
}

variable "image_tag" {
  description = "Container image tag to deploy"
  type        = string
  default     = "latest"
}

-- 0017_audit_fixes.sql
-- Audit batch: drop hourly_rate, fix types, add constraints and indexes

-- 1. Remove hourly_rate column (instructors are salary-based)
ALTER TABLE driver_profiles DROP COLUMN IF EXISTS hourly_rate;

-- 2. Fix password_reset_tokens column types
ALTER TABLE password_reset_tokens
  ALTER COLUMN user_id TYPE BIGINT,
  ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC',
  ALTER COLUMN used_at TYPE TIMESTAMPTZ USING used_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- 3. Add UNIQUE index on invitation token (prevent token collisions)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token ON school_invitations(token);

-- 4. Add CHECK constraints for data integrity
ALTER TABLE bookings ADD CONSTRAINT chk_booking_times CHECK (start_time < end_time);
ALTER TABLE driver_availability ADD CONSTRAINT chk_avail_times CHECK (start_time < end_time);
ALTER TABLE addresses ADD CONSTRAINT chk_lat CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
ALTER TABLE addresses ADD CONSTRAINT chk_lng CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
ALTER TABLE driver_profiles ADD CONSTRAINT chk_radius CHECK (service_radius_km IS NULL OR service_radius_km >= 0);

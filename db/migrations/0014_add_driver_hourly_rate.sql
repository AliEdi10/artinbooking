-- Add hourly rate column to driver profiles for earnings tracking
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) DEFAULT NULL;

-- Create index for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_id ON audit_logs(driving_school_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

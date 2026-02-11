-- 0016: add missing indexes for profile lookups and availability queries

-- Fast profile lookup by user_id + school (used in login, auth checks)
CREATE INDEX IF NOT EXISTS idx_driver_profiles_user_school
  ON driver_profiles (user_id, driving_school_id);

CREATE INDEX IF NOT EXISTS idx_student_profiles_user_school
  ON student_profiles (user_id, driving_school_id);

-- Compound index for availability queries scoped by school
CREATE INDEX IF NOT EXISTS idx_driver_availability_school_driver_date
  ON driver_availability (driving_school_id, driver_id, date);

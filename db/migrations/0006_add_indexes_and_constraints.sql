-- 0006: add indexes and tenant/role constraints

-- Enforce tenant scoping on users: non-superadmins must have a driving_school_id
ALTER TABLE users
    ADD CONSTRAINT users_driving_school_required_for_non_superadmin
    CHECK (role = 'SUPERADMIN' OR driving_school_id IS NOT NULL);

-- Ensure driver/student profiles align with user roles via triggers
CREATE OR REPLACE FUNCTION ensure_driver_profile_user_role()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM users u WHERE u.id = NEW.user_id AND u.role = 'DRIVER'
    ) THEN
        RAISE EXCEPTION 'driver_profile user_id % must reference a user with role DRIVER', NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ensure_student_profile_user_role()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM users u WHERE u.id = NEW.user_id AND u.role = 'STUDENT'
    ) THEN
        RAISE EXCEPTION 'student_profile user_id % must reference a user with role STUDENT', NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_driver_profiles_role
BEFORE INSERT OR UPDATE ON driver_profiles
FOR EACH ROW EXECUTE FUNCTION ensure_driver_profile_user_role();

CREATE TRIGGER trg_student_profiles_role
BEFORE INSERT OR UPDATE ON student_profiles
FOR EACH ROW EXECUTE FUNCTION ensure_student_profile_user_role();

-- Indexes for lookup speed
CREATE INDEX IF NOT EXISTS idx_users_driving_school_role ON users (driving_school_id, role);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_school ON driver_profiles (driving_school_id, active);
CREATE INDEX IF NOT EXISTS idx_student_profiles_school ON student_profiles (driving_school_id, active);
CREATE INDEX IF NOT EXISTS idx_addresses_student ON addresses (student_id, is_default_pickup, is_default_dropoff);
CREATE INDEX IF NOT EXISTS idx_bookings_school_driver_date ON bookings (driving_school_id, driver_id, start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_school_student_date ON bookings (driving_school_id, student_id, start_time);
CREATE INDEX IF NOT EXISTS idx_driver_availability_date ON driver_availability (driver_id, date);

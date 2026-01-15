-- 0002: add driver and student profiles

CREATE TABLE IF NOT EXISTS driver_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    driving_school_id BIGINT NOT NULL REFERENCES driving_schools(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    service_center_location JSONB,  -- {lat, lng} or null
    work_day_start TIME,
    work_day_end TIME,
    lesson_duration_minutes INTEGER,
    buffer_minutes_between_lessons INTEGER,
    service_radius_km NUMERIC(6,2),
    max_segment_travel_time_min INTEGER,
    max_segment_travel_distance_km NUMERIC(6,2),
    daily_max_travel_time_min INTEGER,
    daily_max_travel_distance_km NUMERIC(6,2),
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    driving_school_id BIGINT NOT NULL REFERENCES driving_schools(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    date_of_birth DATE,
    phone TEXT,
    email TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE driver_profiles IS 'Operational profile for instructors.';
COMMENT ON TABLE student_profiles IS 'Profile for students/clients.';

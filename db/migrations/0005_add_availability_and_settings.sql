-- 0005: add availability, settings, and bookings

CREATE TYPE availability_type AS ENUM ('working_hours', 'override_open', 'override_closed');
CREATE TYPE booking_status AS ENUM (
    'scheduled',
    'completed',
    'cancelled_by_student',
    'cancelled_by_driver',
    'cancelled_by_school'
);

CREATE TABLE IF NOT EXISTS driver_availability (
    id BIGSERIAL PRIMARY KEY,
    driving_school_id BIGINT NOT NULL REFERENCES driving_schools(id) ON DELETE CASCADE,
    driver_id BIGINT NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    type availability_type NOT NULL DEFAULT 'working_hours',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_settings (
    id BIGSERIAL PRIMARY KEY,
    driving_school_id BIGINT NOT NULL UNIQUE REFERENCES driving_schools(id) ON DELETE CASCADE,
    min_booking_lead_time_hours INTEGER,
    cancellation_cutoff_hours INTEGER,
    default_lesson_duration_minutes INTEGER,
    default_buffer_minutes_between_lessons INTEGER,
    default_service_radius_km NUMERIC(6,2),
    default_max_segment_travel_time_min INTEGER,
    default_max_segment_travel_distance_km NUMERIC(6,2),
    default_daily_max_travel_time_min INTEGER,
    default_daily_max_travel_distance_km NUMERIC(6,2),
    allow_student_to_pick_driver BOOLEAN NOT NULL DEFAULT TRUE,
    allow_driver_self_availability_edit BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
    id BIGSERIAL PRIMARY KEY,
    driving_school_id BIGINT NOT NULL REFERENCES driving_schools(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    driver_id BIGINT NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
    pickup_address_id BIGINT REFERENCES addresses(id) ON DELETE SET NULL,
    dropoff_address_id BIGINT REFERENCES addresses(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status booking_status NOT NULL DEFAULT 'scheduled',
    cancellation_reason_code TEXT,
    price_amount NUMERIC(10,2),
    notes TEXT,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE driver_availability IS 'Availability windows and overrides per driver.';
COMMENT ON TABLE school_settings IS 'Per-school policy configuration defaults.';
COMMENT ON TABLE bookings IS 'Scheduled lessons between students and drivers.';

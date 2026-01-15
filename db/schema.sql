-- artinbk database schema reference

-- Types
CREATE TYPE user_role AS ENUM ('SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER', 'STUDENT');
CREATE TYPE user_status AS ENUM ('active', 'disabled');
CREATE TYPE driving_school_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE licence_status AS ENUM ('pending_review', 'approved', 'rejected');
CREATE TYPE availability_type AS ENUM ('working_hours', 'override_open', 'override_closed');
CREATE TYPE booking_status AS ENUM ('scheduled', 'completed', 'cancelled_by_student', 'cancelled_by_driver', 'cancelled_by_school');

-- Tables
-- driving_schools: tenant record with contact and office address metadata
CREATE TABLE driving_schools (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    legal_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    province_or_state TEXT,
    postal_code TEXT,
    country TEXT,
    status driving_school_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- users: authenticated accounts; non-SUPERADMIN rows must include driving_school_id
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    driving_school_id BIGINT REFERENCES driving_schools(id) ON DELETE SET NULL,
    email TEXT NOT NULL UNIQUE,
    identity_provider TEXT NOT NULL DEFAULT 'google',
    identity_subject TEXT,
    password_hash TEXT,
    role user_role NOT NULL,
    status user_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_driving_school_required_for_non_superadmin CHECK (role = 'SUPERADMIN' OR driving_school_id IS NOT NULL),
    CONSTRAINT users_identity_or_password CHECK (identity_subject IS NOT NULL OR password_hash IS NOT NULL),
    CONSTRAINT users_identity_unique UNIQUE (identity_provider, identity_subject)
);

-- driver_profiles: instructor metadata and travel constraints
CREATE TABLE driver_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    driving_school_id BIGINT NOT NULL REFERENCES driving_schools(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    service_center_location GEOGRAPHY(POINT, 4326),
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

-- student_profiles: student metadata and licence status
CREATE TABLE student_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    driving_school_id BIGINT NOT NULL REFERENCES driving_schools(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    date_of_birth DATE,
    phone TEXT,
    email TEXT,
    licence_number TEXT,
    licence_expiry_date DATE,
    licence_province_or_state TEXT,
    licence_image_url TEXT,
    licence_status licence_status NOT NULL DEFAULT 'pending_review',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- school_invitations: pending role-based invitations
CREATE TABLE school_invitations (
    id BIGSERIAL PRIMARY KEY,
    driving_school_id BIGINT NOT NULL REFERENCES driving_schools(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role user_role NOT NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (driving_school_id, email, role)
);

-- addresses: reusable address book (optionally tied to a student)
CREATE TABLE addresses (
    id BIGSERIAL PRIMARY KEY,
    driving_school_id BIGINT NOT NULL REFERENCES driving_schools(id) ON DELETE CASCADE,
    student_id BIGINT REFERENCES student_profiles(id) ON DELETE SET NULL,
    label TEXT,
    line1 TEXT NOT NULL,
    line2 TEXT,
    city TEXT,
    province_or_state TEXT,
    postal_code TEXT,
    country TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_default_pickup BOOLEAN NOT NULL DEFAULT FALSE,
    is_default_dropoff BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- driver_availability: availability windows and overrides per driver
CREATE TABLE driver_availability (
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

-- school_settings: per-tenant booking defaults and policy flags
CREATE TABLE school_settings (
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

-- bookings: scheduled lessons tying students, drivers, and addresses
CREATE TABLE bookings (
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

-- audit_logs: traceability for actions across the platform
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    driving_school_id BIGINT REFERENCES driving_schools(id) ON DELETE SET NULL,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id BIGINT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index/constraint notes
-- * Non-SUPERADMIN users must have driving_school_id.
-- * Driver/student profiles are checked against their expected user roles (triggers in migration 0006).
-- * Lookups are optimized on common tenant, driver, student, and date fields plus audit log timelines.

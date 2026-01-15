-- 0003: add invitations and addresses

CREATE TABLE IF NOT EXISTS school_invitations (
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

CREATE TABLE IF NOT EXISTS addresses (
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

COMMENT ON TABLE school_invitations IS 'Invitations to onboard users to a school with a specific role.';
COMMENT ON TABLE addresses IS 'Addresses used for pickup/dropoff or office locations, optionally tied to a student.';

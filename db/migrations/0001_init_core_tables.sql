-- 0001: init core tables

-- Extensions (PostGIS optional - commented out for basic PostgreSQL)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- Enumerated types
CREATE TYPE user_role AS ENUM ('SUPERADMIN', 'SCHOOL_ADMIN', 'DRIVER', 'STUDENT');
CREATE TYPE user_status AS ENUM ('active', 'disabled');
CREATE TYPE driving_school_status AS ENUM ('active', 'suspended', 'deleted');

-- Core tables
CREATE TABLE IF NOT EXISTS driving_schools (
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

CREATE TABLE IF NOT EXISTS users (
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
    CONSTRAINT users_identity_or_password CHECK (identity_subject IS NOT NULL OR password_hash IS NOT NULL),
    CONSTRAINT users_identity_unique UNIQUE (identity_provider, identity_subject)
);

COMMENT ON TABLE driving_schools IS 'Tenant scope for the platform.';
COMMENT ON TABLE users IS 'Authenticated users, scoped by driving_school_id except for SUPERADMIN.';

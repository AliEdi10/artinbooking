-- 0004: add licence fields to student profiles

CREATE TYPE licence_status AS ENUM ('pending_review', 'approved', 'rejected');

ALTER TABLE student_profiles
    ADD COLUMN licence_number TEXT,
    ADD COLUMN licence_expiry_date DATE,
    ADD COLUMN licence_province_or_state TEXT,
    ADD COLUMN licence_image_url TEXT,
    ADD COLUMN licence_status licence_status NOT NULL DEFAULT 'pending_review';

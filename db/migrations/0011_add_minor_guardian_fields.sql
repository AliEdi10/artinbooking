-- 0011: add minor and guardian fields to student profiles

ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS is_minor BOOLEAN DEFAULT FALSE;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS guardian_phone TEXT;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS guardian_email TEXT;

COMMENT ON COLUMN student_profiles.is_minor IS 'True if student is under 18 years old';
COMMENT ON COLUMN student_profiles.guardian_phone IS 'Guardian phone number for minors';
COMMENT ON COLUMN student_profiles.guardian_email IS 'Guardian email for minors';

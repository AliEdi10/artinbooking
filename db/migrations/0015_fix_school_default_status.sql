-- Fix: Change default school status from 'active' to 'suspended'
-- Schools should start suspended and activate when SCHOOL_ADMIN accepts invitation
ALTER TABLE driving_schools ALTER COLUMN status SET DEFAULT 'suspended';

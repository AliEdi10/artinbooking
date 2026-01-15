-- Migration: Add student booking limits and enhance invitations
-- This migration adds allowed_hours and max_lessons_per_day to both
-- student_profiles and school_invitations tables

-- Add booking limit fields to student_profiles
ALTER TABLE student_profiles 
  ADD COLUMN IF NOT EXISTS allowed_hours INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_lessons_per_day INTEGER DEFAULT 2;

COMMENT ON COLUMN student_profiles.allowed_hours IS 'Total allowed lesson hours for this student (NULL = unlimited)';
COMMENT ON COLUMN student_profiles.max_lessons_per_day IS 'Maximum lessons this student can book per day';

-- Add booking limit fields to school_invitations (to be copied to profile on accept)
ALTER TABLE school_invitations 
  ADD COLUMN IF NOT EXISTS allowed_hours INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_lessons_per_day INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT NULL;

COMMENT ON COLUMN school_invitations.allowed_hours IS 'Allowed hours to copy to student profile on invitation accept';
COMMENT ON COLUMN school_invitations.max_lessons_per_day IS 'Max lessons per day to copy to student profile on invitation accept';
COMMENT ON COLUMN school_invitations.full_name IS 'Full name to pre-populate in student profile';

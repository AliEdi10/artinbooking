-- Add licence rejection note for students
ALTER TABLE student_profiles 
  ADD COLUMN IF NOT EXISTS licence_rejection_note TEXT DEFAULT NULL;

-- Add contact email to driver profiles (separate from login email on users table)
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS email TEXT;

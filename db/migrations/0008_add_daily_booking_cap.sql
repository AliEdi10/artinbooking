-- 0008: add daily booking cap per driver
ALTER TABLE school_settings
ADD COLUMN IF NOT EXISTS daily_booking_cap_per_driver INTEGER;

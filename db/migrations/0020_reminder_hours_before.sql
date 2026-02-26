-- 0020: add configurable reminder hours to school_settings
ALTER TABLE school_settings
  ADD COLUMN IF NOT EXISTS reminder_hours_before INT NOT NULL DEFAULT 24;

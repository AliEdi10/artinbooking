-- 0021: per-school customizable email templates
CREATE TABLE IF NOT EXISTS school_email_templates (
  id BIGSERIAL PRIMARY KEY,
  driving_school_id BIGINT NOT NULL REFERENCES driving_schools(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,   -- 'booking_confirmation' | 'booking_cancelled' | 'lesson_reminder' | 'invitation'
  subject TEXT,                 -- custom subject line (NULL = use default)
  custom_note TEXT,             -- plain-text note injected at top of email body (NULL = omit)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(driving_school_id, template_key)
);

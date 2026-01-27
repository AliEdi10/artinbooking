-- Add reminder_sent_at column to track when lesson reminders were sent
-- This prevents duplicate reminders being sent for the same booking

ALTER TABLE bookings ADD COLUMN reminder_sent_at TIMESTAMP;

-- Partial index for efficient reminder queries
-- Only indexes scheduled bookings that haven't received a reminder yet
CREATE INDEX idx_bookings_pending_reminders 
ON bookings(start_time, reminder_sent_at) 
WHERE status = 'scheduled' AND reminder_sent_at IS NULL;

COMMENT ON COLUMN bookings.reminder_sent_at IS 'Timestamp when the 24-hour lesson reminder was sent. NULL means no reminder sent yet.';

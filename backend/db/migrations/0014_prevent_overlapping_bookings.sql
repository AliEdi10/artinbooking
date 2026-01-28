-- Add btree_gist extension for mixing = and && operators in exclusion constraints
-- This extension is usually standard but must be enabled explicitly
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Prevent overlapping bookings for the same driver
-- This ensures a driver cannot be booked for two lessons at the same time
-- Overlap is determined by the && operator on tstzrange(start_time, end_time)
-- We exclude cancelled bookings from this check to allow re-booking a slot if the previous one was cancelled
ALTER TABLE bookings
ADD CONSTRAINT no_overlapping_driver_bookings
EXCLUDE USING GIST (
    driver_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
)
WHERE (
    status != 'cancelled_by_student' AND
    status != 'cancelled_by_driver' AND
    status != 'cancelled_by_school'
);

-- Prevent overlapping bookings for the same student
-- This ensures a student cannot be in two lessons at the same time
ALTER TABLE bookings
ADD CONSTRAINT no_overlapping_student_bookings
EXCLUDE USING GIST (
    student_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
)
WHERE (
    status != 'cancelled_by_student' AND
    status != 'cancelled_by_driver' AND
    status != 'cancelled_by_school'
);
